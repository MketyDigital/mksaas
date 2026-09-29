import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { customDomains } from '@/shared/db/schema';
import { assertPublicHostname } from '@/shared/security/outbound-url';

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
  const safeHostname = assertPublicHostname(hostname, 'Enterprise AI route-proof hostname');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(
      `https://${safeHostname}/api/v1/ai/domain-route-proof`,
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
      body.hostname === safeHostname &&
      body.tenant_id === expectedTenantId;
    return {
      ok,
      hostname: safeHostname,
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
  // This endpoint is the proof used to promote a pending hostname to verified.
  // Do not require status=verified here or the live-route fallback becomes circular.
  // Normal Enterprise AI hostname resolution still requires verified status separately.
  const domain = await db.query.customDomains.findFirst({
    where: eq(customDomains.hostname, normalized),
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
