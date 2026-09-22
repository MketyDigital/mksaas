import { ENTITLEMENT_KEYS } from '@/features/entitlements/entitlement-keys';

import {
  getSelfServiceBillingPlan,
  isSelfServiceBillingPlanKey,
  SELF_SERVICE_BILLING_PLANS,
} from './self-service-plans';

describe('self-service billing catalog', () => {
  it('contains only the approved fixed-price public plans', () => {
    expect(SELF_SERVICE_BILLING_PLANS.starter.description).toMatch(/Pages-first website and publishing/i);
    expect(SELF_SERVICE_BILLING_PLANS['ai-workspace'].description).toMatch(/AI Agent Builder/i);
    expect(SELF_SERVICE_BILLING_PLANS['automation-workspace'].description).toMatch(/Visual workflow/i);
    expect(SELF_SERVICE_BILLING_PLANS['deploy-workspace'].description).toMatch(/serverless and edge deployment/i);

    expect(Object.keys(SELF_SERVICE_BILLING_PLANS)).toEqual([
      'starter',
      'ai-workspace',
      'automation-workspace',
      'deploy-workspace',
      'mkety-one',
    ]);
  });

  it('stores exact USD prices in integer minor units', () => {
    expect(SELF_SERVICE_BILLING_PLANS.starter.amountMinor).toBe(599n);
    expect(SELF_SERVICE_BILLING_PLANS['ai-workspace'].amountMinor).toBe(1699n);
    expect(SELF_SERVICE_BILLING_PLANS['automation-workspace'].amountMinor).toBe(1699n);
    expect(SELF_SERVICE_BILLING_PLANS['deploy-workspace'].amountMinor).toBe(999n);
    expect(SELF_SERVICE_BILLING_PLANS['mkety-one'].amountMinor).toBe(4900n);
    expect(Object.values(SELF_SERVICE_BILLING_PLANS).every((plan) => plan.currency === 'USD')).toBe(true);
  });

  it('uses only registered entitlement keys', () => {
    const registered = new Set<string>(ENTITLEMENT_KEYS);
    for (const plan of Object.values(SELF_SERVICE_BILLING_PLANS)) {
      for (const entitlement of plan.entitlements) {
        expect(registered.has(entitlement)).toBe(true);
      }
    }
  });

  it('fails closed for unknown plans', () => {
    expect(isSelfServiceBillingPlanKey('enterprise')).toBe(false);
    expect(() => getSelfServiceBillingPlan('enterprise')).toThrow('Unknown self-service billing plan');
  });
});
