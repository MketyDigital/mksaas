import { and, eq } from 'drizzle-orm';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { customDomains, tenants } from '@/shared/db/schema';

const CLOUDFLARE_FOR_SAAS_PROVIDER = 'cloudflare-for-saas';

type EnterpriseHostnameMetadata = {
  purpose: 'enterprise-ai';
  cnameTarget: string;
  cloudflareCustomHostnameId?: string;
  sslStatus?: string | null;
  managed?: boolean;
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

  // A hostname is real only after an explicit verified provisioning record exists.
  // Never infer *.mkety.app availability from the tenant slug alone.
  const domain = await db.query.customDomains.findFirst({
    where: and(eq(customDomains.hostname, normalized), eq(customDomains.status, 'verified')),
  });
  if (!domain) return null;

  const metadata = parseMetadata(domain.providerVerified);
  if (domain.provider !== CLOUDFLARE_FOR_SAAS_PROVIDER || !metadata) return null;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, domain.tenantId) });
  if (!tenant) return null;

  const enterprise = await hasEntitlement({
    tenantId: tenant.id,
    entitlement: 'workspace.ai.enterprise',
  });
  if (!enterprise) return null;

  const managed = metadata.managed === true && normalized.endsWith('.mkety.app');
  if (!managed) {
    const whiteLabel = await hasEntitlement({
      tenantId: tenant.id,
      entitlement: 'ai.whitelabel',
    });
    if (!whiteLabel) return null;
  }

  return {
    tenant,
    hostname: normalized,
    kind: managed ? 'managed' as const : 'custom' as const,
    metadata,
  };
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
