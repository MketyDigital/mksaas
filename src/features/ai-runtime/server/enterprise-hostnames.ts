import { and, eq } from 'drizzle-orm';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { customDomains, tenants } from '@/shared/db/schema';

const CLOUDFLARE_FOR_SAAS_PROVIDER = 'cloudflare-for-saas';

type EnterpriseHostnameMetadata = {
  purpose: 'enterprise-ai';
  cnameTarget: string;
  cloudflareCustomHostnameId?: string;
  sslStatus?: string;
};

function parseMetadata(value: string | null): EnterpriseHostnameMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as EnterpriseHostnameMetadata;
    return parsed?.purpose === 'enterprise-ai' ? parsed : null;
  } catch {
    return null;
  }
}

export async function resolveEnterpriseAiHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (normalized.endsWith('.mkety.app')) {
    const subdomain = normalized.slice(0, -'.mkety.app'.length);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, subdomain) });
    if (!tenant) return null;
    const entitled = await hasEntitlement({ tenantId: tenant.id, entitlement: 'workspace.ai.enterprise' });
    return entitled ? { tenant, hostname: normalized, kind: 'managed' as const } : null;
  }

  const domain = await db.query.customDomains.findFirst({
    where: and(eq(customDomains.hostname, normalized), eq(customDomains.status, 'verified')),
  });
  if (!domain) return null;

  const metadata = parseMetadata(domain.providerVerified);
  if (domain.provider !== CLOUDFLARE_FOR_SAAS_PROVIDER || !metadata) return null;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, domain.tenantId) });
  if (!tenant) return null;

  const [enterprise, whitelabel] = await Promise.all([
    hasEntitlement({ tenantId: tenant.id, entitlement: 'workspace.ai.enterprise' }),
    hasEntitlement({ tenantId: tenant.id, entitlement: 'ai.whitelabel' }),
  ]);
  if (!enterprise || !whitelabel) return null;

  return { tenant, hostname: normalized, kind: 'custom' as const, metadata };
}

export function buildEnterpriseAiDnsInstructions(hostname: string, cnameTarget: string) {
  return {
    recordType: 'CNAME' as const,
    name: hostname,
    target: cnameTarget,
    proxied: false,
    message: `Add one CNAME record: ${hostname} -> ${cnameTarget}. Mkety handles TLS and application routing after verification.`,
  };
}
