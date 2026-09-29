import { hasEntitlement } from '@/features/entitlements/server/resolver';

export async function hasEnterpriseAiAccess(tenantId: string) {
  return hasEntitlement({ tenantId, entitlement: 'workspace.ai.enterprise' });
}

export async function hasEnterpriseAiApiAccess(tenantId: string) {
  const [enterprise, api] = await Promise.all([
    hasEnterpriseAiAccess(tenantId),
    hasEntitlement({ tenantId, entitlement: 'ai.api' }),
  ]);
  return enterprise && api;
}

export async function hasEnterpriseAiWhiteLabelAccess(tenantId: string) {
  const [enterprise, whiteLabel] = await Promise.all([
    hasEnterpriseAiAccess(tenantId),
    hasEntitlement({ tenantId, entitlement: 'ai.whitelabel' }),
  ]);
  return enterprise && whiteLabel;
}
