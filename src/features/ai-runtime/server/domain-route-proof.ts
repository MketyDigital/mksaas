import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { customDomains } from '@/shared/db/schema';

type RouteProof = {
  ok: boolean;
  hostname: string;
  tenantId?: string;
  reason?: string;
};

export async function probeEnterpriseAiHostnameRoute(
  hostname: string,
  expectedTenantId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RouteProof> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(
      `https://${hostname}/api/v1/ai/domain-route-proof`,
      {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      return { ok: false, hostname, reason: 'route_probe_http_error' };
    }
    const body = await response.json() as {
      ok?: boolean;
      hostname?: string;
      tenant_id?: string;
    };
    const ok =
      body.ok === true &&
      body.hostname === hostname &&
      body.tenant_id === expectedTenantId;
    return {
      ok,
      hostname,
      tenantId: body.tenant_id,
      ...(ok ? {} : { reason: 'route_probe_tenant_mismatch' }),
    };
  } catch {
    return { ok: false, hostname, reason: 'route_probe_failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function readEnterpriseAiRouteProof(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  const domain = await db.query.customDomains.findFirst({
    where: and(eq(customDomains.hostname, normalized), eq(customDomains.status, 'verified')),
  });
  if (!domain) return null;

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(domain.providerVerified ?? '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  if (
    domain.provider !== 'cloudflare-for-saas' ||
    metadata.purpose !== 'enterprise-ai'
  ) {
    return null;
  }

  return {
    hostname: normalized,
    tenantId: domain.tenantId,
  };
}
