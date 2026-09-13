import { EntitlementDeniedError } from '../types';
import { requireEntitlement } from './authorization';
import type { EntitlementSource } from './resolver';

function source(allowed: boolean): EntitlementSource {
  return {
    getCurrentPlanVersionId: jest.fn().mockResolvedValue('plan-v1'),
    getPlanEntitlements: jest.fn().mockResolvedValue(
      allowed ? [{ entitlementKey: 'workspace.workflows', enabled: true }] : [],
    ),
    getTenantOverrides: jest.fn().mockResolvedValue([]),
  };
}

describe('requireEntitlement', () => {
  it('returns when the tenant is entitled', async () => {
    await expect(
      requireEntitlement(
        { tenantId: 'tenant-a', entitlement: 'workspace.workflows' },
        source(true),
      ),
    ).resolves.toBeUndefined();
  });

  it('throws a stable authorization error when denied', async () => {
    await expect(
      requireEntitlement(
        { tenantId: 'tenant-a', entitlement: 'workspace.workflows' },
        source(false),
      ),
    ).rejects.toBeInstanceOf(EntitlementDeniedError);
  });

  it('fails closed for an unknown entitlement key', async () => {
    await expect(
      requireEntitlement(
        { tenantId: 'tenant-a', entitlement: 'workspace.unknown' },
        source(true),
      ),
    ).rejects.toMatchObject({ code: 'ENTITLEMENT_DENIED' });
  });
});
