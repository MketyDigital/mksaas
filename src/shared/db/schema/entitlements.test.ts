import { billingPlanVersionEntitlements } from './billing-plan-version-entitlements';
import { tenantEntitlementOverrides, tenantEntitlementOverrideEffectEnum } from './tenant-entitlement-overrides';

describe('entitlement persistence schema', () => {
  it('exposes plan-version entitlement assignments', () => {
    expect(billingPlanVersionEntitlements.planVersionId).toBeDefined();
    expect(billingPlanVersionEntitlements.entitlementKey).toBeDefined();
    expect(billingPlanVersionEntitlements.enabled).toBeDefined();
  });

  it('exposes tenant grant/deny overrides with expiry and actor metadata', () => {
    expect(tenantEntitlementOverrides.tenantId).toBeDefined();
    expect(tenantEntitlementOverrides.entitlementKey).toBeDefined();
    expect(tenantEntitlementOverrides.effect).toBeDefined();
    expect(tenantEntitlementOverrides.expiresAt).toBeDefined();
    expect(tenantEntitlementOverrides.actorUserId).toBeDefined();
    expect(tenantEntitlementOverrideEffectEnum.enumValues).toEqual(['grant', 'deny']);
  });
});
