import type { WorkspaceCardInput } from '@/features/platform-app-experience/schemas';

import { type EntitlementSource, hasEntitlement } from './resolver';

export async function filterWorkspaceCardsByEntitlement(
  workspaces: WorkspaceCardInput[],
  tenantId: string,
  source?: EntitlementSource,
): Promise<WorkspaceCardInput[]> {
  const decisions = await Promise.all(
    workspaces.map(async (workspace) => {
      if (!workspace.requiresEntitlement) return { workspace, allowed: true };

      const allowed = await hasEntitlement(
        { tenantId, entitlement: workspace.requiresEntitlement },
        source,
      );
      return { workspace, allowed };
    }),
  );

  return decisions.filter((decision) => decision.allowed).map((decision) => decision.workspace);
}
