'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import {
  createCloudflareSaasHostname,
  deleteCloudflareSaasHostname,
  getCloudflareSaasHostname,
  retryCloudflareSaasHostnameValidation,
} from '@/features/domains/server/cloudflare-saas';
import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import { requireTenantAdmin } from '@/shared/lib/rbac';

export type DomainActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

type MketyDomainVerification = {
  providerHostnameId: string;
  cnameTarget: string;
  ownershipVerification?: {
    type?: string;
    name?: string;
    value?: string;
  } | null;
  sslStatus?: string | null;
};

function normalizeHostname(value: string) {
  const raw = value.trim().toLowerCase();
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  const hostname = url.hostname.replace(/^www\./, '');
  if (!hostname || hostname.includes('..') || hostname.length > 255) throw new Error('Invalid hostname');
  if (!hostname.includes('.')) throw new Error('Enter a real domain such as app.example.com');
  return hostname;
}

function parseVerification(value: string | null): MketyDomainVerification | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as MketyDomainVerification;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function revalidate(tenantSlug: string) {
  revalidatePath(`/app/${tenantSlug}/admin/settings/domains`);
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
  if (existing) return { success: false, error: 'This domain is already connected to Mkety.' };

  let managed;
  try {
    managed = await createCloudflareSaasHostname(hostname);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Mkety could not create the custom hostname.',
    };
  }

  const verification: MketyDomainVerification = {
    providerHostnameId: managed.id,
    cnameTarget: managed.cnameTarget,
    ownershipVerification: managed.ownershipVerification ?? null,
    sslStatus: managed.sslStatus,
  };

  const [domain] = await db
    .insert(schema.customDomains)
    .values({
      tenantId: tenant.id,
      hostname,
      provider: 'mkety',
      providerVerified: String(managed.status === 'active' && managed.sslStatus === 'active'),
      verification: JSON.stringify(verification),
      status: managed.status === 'active' && managed.sslStatus === 'active' ? 'verified' : 'pending',
    })
    .returning();

  revalidate(tenantSlug);
  return {
    success: true,
    data: domain,
    message: managed.status === 'active' && managed.sslStatus === 'active'
      ? 'Domain connected and HTTPS is active.'
      : `Domain added. Point the hostname to ${managed.cnameTarget}, then verify again.`,
  };
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

  const verification = parseVerification(domain.verification);
  if (!verification?.providerHostnameId) {
    return {
      success: false,
      error: 'This domain uses a legacy provider record. Remove it and reconnect through Mkety Domains.',
    };
  }

  let provider;
  try {
    provider = await retryCloudflareSaasHostnameValidation(verification.providerHostnameId);
    if (provider.status !== 'active' || provider.ssl?.status !== 'active') {
      provider = await getCloudflareSaasHostname(verification.providerHostnameId);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mkety could not verify this hostname.',
    };
  }

  const verified = provider.status === 'active' && provider.ssl?.status === 'active';
  const nextVerification: MketyDomainVerification = {
    ...verification,
    ownershipVerification: provider.ownership_verification ?? verification.ownershipVerification ?? null,
    sslStatus: provider.ssl?.status ?? null,
  };
  const [updated] = await db
    .update(schema.customDomains)
    .set({
      status: verified ? 'verified' : 'pending',
      provider: 'mkety',
      providerVerified: String(verified),
      verification: JSON.stringify(nextVerification),
      updatedAt: new Date(),
    })
    .where(eq(schema.customDomains.id, domain.id))
    .returning();

  revalidate(tenantSlug);
  return {
    success: true,
    data: updated,
    message: verified
      ? 'Domain verified. Mkety routing and HTTPS are active.'
      : `Verification is still pending. Confirm the CNAME points to ${verification.cnameTarget} and try again.`,
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

  const verification = parseVerification(domain.verification);
  if (verification?.providerHostnameId) {
    try {
      await deleteCloudflareSaasHostname(verification.providerHostnameId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mkety could not remove the managed hostname.',
      };
    }
  }

  await db.delete(schema.customDomains).where(eq(schema.customDomains.id, domain.id));
  revalidate(tenantSlug);
  return { success: true, data: null, message: 'Domain removed from Mkety.' };
}
