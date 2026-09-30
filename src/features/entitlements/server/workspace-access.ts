import { isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import type { WorkspaceCardInput } from '@/features/platform-app-experience/schemas';

import {
  type EntitlementSource,
  getTenantEntitlements,
  getTenantEntitlementsForRequest,
} from './resolver';

export async function filterWorkspaceCardsByEntitlement(
  workspaces: WorkspaceCardInput[],
  tenantId: string,
  source?: EntitlementSource,
): Promise<WorkspaceCardInput[]> {
  const entitlements = source
    ? await getTenantEntitlements(tenantId, { source })
    : await getTenantEntitlementsForRequest(tenantId);
  const allowed = new Set(
    entitlements.filter((item) => item.allowed).map((item) => item.entitlement),
  );

  return workspaces.filter((workspace) => {
    if (!workspace.requiresEntitlement) return true;
    return isEntitlementKey(workspace.requiresEntitlement) && allowed.has(workspace.requiresEntitlement);
  });
}
