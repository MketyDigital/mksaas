import { ENTITLEMENT_KEYS } from '@/features/entitlements/entitlement-keys';

import {
  getSelfServiceBillingPlan,
  getSelfServiceBillingQuote,
  isSelfServiceBillingPlanKey,
  SELF_SERVICE_BILLING_PLANS,
  SELF_SERVICE_BILLING_TERMS,
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

  it('supports 1, 3, 6 and 12 month prepaid terms with increasing discounts', () => {
    expect(Object.keys(SELF_SERVICE_BILLING_TERMS)).toEqual(['1m', '3m', '6m', '12m']);
    expect(Object.values(SELF_SERVICE_BILLING_TERMS).map((term) => term.discountPercent)).toEqual([0, 5, 10, 15]);

    expect(getSelfServiceBillingQuote('starter', '1m').amountMinor).toBe(599n);
    expect(getSelfServiceBillingQuote('starter', '3m').amountMinor).toBe(1707n);
    expect(getSelfServiceBillingQuote('starter', '6m').amountMinor).toBe(3235n);
    expect(getSelfServiceBillingQuote('starter', '12m').amountMinor).toBe(6110n);

    expect(getSelfServiceBillingQuote('ai-workspace', '12m').amountMinor).toBe(17330n);
    expect(getSelfServiceBillingQuote('deploy-workspace', '12m').amountMinor).toBe(10190n);
    expect(getSelfServiceBillingQuote('mkety-one', '12m').amountMinor).toBe(49980n);
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
