'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import { requireTenantAdmin } from '@/shared/lib/rbac';

export type DomainActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

function getVercelConfig() {
  const token = process.env.VERCEL_AUTH_BEARER_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const apiUrl = (process.env.VERCEL_API_URL || 'https://api.vercel.com').replace(/\/$/, '');

  if (!token || !projectId) return null;
  return { token, projectId, teamId, apiUrl };
}

function withTeam(url: string, teamId?: string) {
  return teamId ? `${url}${url.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}` : url;
}

function normalizeHostname(value: string) {
  const raw = value.trim().toLowerCase();
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  const hostname = url.hostname.replace(/^www\./, '');
  if (!hostname || hostname.includes('..') || hostname.length > 255) throw new Error('Invalid hostname');
  if (!hostname.includes('.')) throw new Error('Enter a real domain such as app.example.com');
  return hostname;
}

export async function listDomains(tenantSlug: string): Promise<DomainActionResult> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) return { success: false, error: 'Unauthorized' };

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, tenantSlug) });
  if (!tenant) return { success: false, error: 'Tenant not found' };

  const domains = await db.query.customDomains.findMany({
    where: eq(schema.customDomains.tenantId, tenant.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return { success: true, data: domains };
}

export async function addDomain(tenantSlug: string, hostnameInput: string): Promise<DomainActionResult> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) return { success: false, error: 'Unauthorized' };

  let hostname: string;
  try {
    hostname = normalizeHostname(hostnameInput);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Invalid hostname' };
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, tenantSlug) });
  if (!tenant) return { success: false, error: 'Tenant not found' };

  const existing = await db.query.customDomains.findFirst({ where: eq(schema.customDomains.hostname, hostname) });
  if (existing) return { success: false, error: 'This domain is already registered.' };

  let providerVerified = 'false';
  let verification: unknown = null;
  let message = 'Domain saved locally. Connect Vercel domain credentials to activate provider management.';
  const vercel = getVercelConfig();

  if (vercel) {
    const url = withTeam(`${vercel.apiUrl}/v10/projects/${encodeURIComponent(vercel.projectId)}/domains`, vercel.teamId);
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${vercel.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: hostname }),
      cache: 'no-store',
    });

    const body = (await response.json().catch(() => ({}))) as {
      verified?: boolean;
      verification?: unknown;
      error?: { message?: string };
    };

    if (!response.ok) return { success: false, error: body.error?.message || `Vercel rejected the domain (${response.status}).` };

    providerVerified = String(Boolean(body.verified));
    verification = body.verification ?? null;
    message = body.verified
      ? 'Domain added to Vercel. Check DNS configuration, then use Verify.'
      : 'Domain added to Vercel. Complete the displayed verification/DNS steps, then use Verify.';
  }

  const [domain] = await db
    .insert(schema.customDomains)
    .values({
      tenantId: tenant.id,
      hostname,
      providerVerified,
      verification: verification ? JSON.stringify(verification) : null,
      status: 'pending',
    })
    .returning();

  revalidatePath(`/t/${tenantSlug}/admin/settings/domains`);
  return { success: true, data: domain, message };
}

export async function verifyDomain(tenantSlug: string, hostnameInput: string): Promise<DomainActionResult> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) return { success: false, error: 'Unauthorized' };

  let hostname: string;
  try {
    hostname = normalizeHostname(hostnameInput);
  } catch {
    return { success: false, error: 'Invalid hostname' };
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, tenantSlug) });
  if (!tenant) return { success: false, error: 'Tenant not found' };

  const domain = await db.query.customDomains.findFirst({
    where: and(eq(schema.customDomains.tenantId, tenant.id), eq(schema.customDomains.hostname, hostname)),
  });
  if (!domain) return { success: false, error: 'Domain not found' };

  const vercel = getVercelConfig();
  if (!vercel) {
    return { success: true, data: domain, message: 'Provider verification is disabled until Vercel credentials are configured.' };
  }

  const url = withTeam(
    `${vercel.apiUrl}/v6/domains/${encodeURIComponent(hostname)}/config`,
    vercel.teamId,
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${vercel.token}` },
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => ({}))) as { misconfigured?: boolean; error?: { message?: string } };

  if (!response.ok) return { success: false, error: body.error?.message || `Unable to inspect DNS (${response.status}).` };

  const verified = body.misconfigured === false;
  const [updated] = await db
    .update(schema.customDomains)
    .set({ status: verified ? 'verified' : 'pending', providerVerified: String(verified), updatedAt: new Date() })
    .where(eq(schema.customDomains.id, domain.id))
    .returning();

  revalidatePath(`/t/${tenantSlug}/admin/settings/domains`);
  return {
    success: true,
    data: updated,
    message: verified ? 'Domain is configured correctly.' : 'DNS is not configured yet. Check the required records in Vercel.',
  };
}

export async function removeDomain(tenantSlug: string, hostnameInput: string): Promise<DomainActionResult> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) return { success: false, error: 'Unauthorized' };

  let hostname: string;
  try {
    hostname = normalizeHostname(hostnameInput);
  } catch {
    return { success: false, error: 'Invalid hostname' };
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, tenantSlug) });
  if (!tenant) return { success: false, error: 'Tenant not found' };

  const domain = await db.query.customDomains.findFirst({
    where: and(eq(schema.customDomains.tenantId, tenant.id), eq(schema.customDomains.hostname, hostname)),
  });
  if (!domain) return { success: false, error: 'Domain not found' };

  const vercel = getVercelConfig();
  if (vercel) {
    const url = withTeam(
      `${vercel.apiUrl}/v9/projects/${encodeURIComponent(vercel.projectId)}/domains/${encodeURIComponent(hostname)}`,
      vercel.teamId,
    );
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${vercel.token}` },
      cache: 'no-store',
    });
    if (!response.ok && response.status !== 404) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { success: false, error: body.error?.message || `Unable to remove domain from Vercel (${response.status}).` };
    }
  }

  await db.delete(schema.customDomains).where(eq(schema.customDomains.id, domain.id));
  revalidatePath(`/t/${tenantSlug}/admin/settings/domains`);
  return { success: true, data: null, message: 'Domain removed.' };
}
