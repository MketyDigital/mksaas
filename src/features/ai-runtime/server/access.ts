import { hasEntitlement } from '@/features/entitlements/server/resolver';

export async function hasEnterpriseAiApiAccess(tenantId: string) {
  const [enterprise, api] = await Promise.all([
    hasEntitlement({ tenantId, entitlement: 'workspace.ai.enterprise' }),
    hasEntitlement({ tenantId, entitlement: 'ai.api' }),
  ]);
  return enterprise && api;
}
