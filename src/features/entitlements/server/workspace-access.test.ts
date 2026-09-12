import type { WorkspaceCardInput } from '@/features/platform-app-experience/schemas';

import type { EntitlementSource } from './resolver';
import { filterWorkspaceCardsByEntitlement } from './workspace-access';

const cards = [
  {
    key: 'agents',
    label: 'Agents',
    description: 'Build agents',
    href: '/agents',
    enabled: true,
    sortOrder: 10,
  },
  {
    key: 'trading',
    label: 'Trading',
    description: 'Enterprise trading',
    href: '/trading',
    enabled: true,
    requiresEntitlement: 'workspace.trading.enterprise',
    sortOrder: 20,
  },
] as WorkspaceCardInput[];

function source(allowTrading: boolean): EntitlementSource {
  return {
    getCurrentPlanVersionId: jest.fn().mockResolvedValue('plan-v1'),
    getPlanEntitlements: jest.fn().mockResolvedValue(
      allowTrading ? [{ entitlementKey: 'workspace.trading.enterprise', enabled: true }] : [],
    ),
    getTenantOverrides: jest.fn().mockResolvedValue([]),
  };
}

describe('filterWorkspaceCardsByEntitlement', () => {
  it('keeps unrestricted workspaces and entitled restricted workspaces', async () => {
    const result = await filterWorkspaceCardsByEntitlement(cards, 'tenant-a', source(true));
    expect(result.map((card) => card.key)).toEqual(['agents', 'trading']);
  });

  it('removes restricted workspaces when the tenant is not entitled', async () => {
    const result = await filterWorkspaceCardsByEntitlement(cards, 'tenant-a', source(false));
    expect(result.map((card) => card.key)).toEqual(['agents']);
  });
});
