import { type EntitlementSource, hasEntitlement } from './resolver';

function source(overrides: Partial<EntitlementSource> = {}): EntitlementSource {
  return {
    getCurrentPlanVersionId: jest.fn().mockResolvedValue('plan-v1'),
    getPlanEntitlements: jest.fn().mockResolvedValue([]),
    getTenantOverrides: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const now = new Date('2026-09-07T12:00:00.000Z');

describe('hasEntitlement', () => {
  it('allows an enabled plan-version grant', async () => {
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({ getPlanEntitlements: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', enabled: true }]) }),
    );
    expect(allowed).toBe(true);
  });

  it('denies when the plan does not grant the capability', async () => {
    await expect(hasEntitlement({ tenantId: 'tenant-a', entitlement: 'workspace.workflows', now }, source())).resolves.toBe(false);
  });

  it('allows an active tenant grant without a plan grant', async () => {
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({ getTenantOverrides: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', effect: 'grant', expiresAt: null }]) }),
    );
    expect(allowed).toBe(true);
  });

  it('lets an active tenant deny beat a plan grant', async () => {
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({
        getPlanEntitlements: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', enabled: true }]),
        getTenantOverrides: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', effect: 'deny', expiresAt: null }]),
      }),
    );
    expect(allowed).toBe(false);
  });

  it('ignores expired overrides', async () => {
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({ getTenantOverrides: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', effect: 'grant', expiresAt: new Date('2026-09-06T12:00:00.000Z') }]) }),
    );
    expect(allowed).toBe(false);
  });

  it('fails closed for unknown entitlement keys without querying storage', async () => {
    const storage = source();
    await expect(hasEntitlement({ tenantId: 'tenant-a', entitlement: 'workspace.unknown', now }, storage)).resolves.toBe(false);
    expect(storage.getCurrentPlanVersionId).not.toHaveBeenCalled();
  });

  it('allows an explicit active tenant grant when there is no qualifying subscription', async () => {
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({
        getCurrentPlanVersionId: jest.fn().mockResolvedValue(null),
        getTenantOverrides: jest.fn().mockResolvedValue([{ entitlementKey: 'workspace.workflows', effect: 'grant', expiresAt: null }]),
      }),
    );
    expect(allowed).toBe(true);
  });

  it('uses only the current subscribed plan version', async () => {
    const getPlanEntitlements = jest.fn(async (planVersionId: string) =>
      planVersionId === 'plan-v2' ? [{ entitlementKey: 'workspace.workflows', enabled: true }] : [],
    );
    const allowed = await hasEntitlement(
      { tenantId: 'tenant-a', entitlement: 'workspace.workflows', now },
      source({ getCurrentPlanVersionId: jest.fn().mockResolvedValue('plan-v2'), getPlanEntitlements }),
    );
    expect(allowed).toBe(true);
    expect(getPlanEntitlements).toHaveBeenCalledWith('plan-v2');
  });

  it('passes the requested tenant only to tenant-scoped reads', async () => {
    const storage = source();
    await hasEntitlement({ tenantId: 'tenant-a', entitlement: 'workspace.workflows', now }, storage);
    expect(storage.getCurrentPlanVersionId).toHaveBeenCalledWith('tenant-a');
    expect(storage.getTenantOverrides).toHaveBeenCalledWith('tenant-a');
  });
});
