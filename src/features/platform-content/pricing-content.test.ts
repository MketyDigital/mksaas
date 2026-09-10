import { defaultPricingPlans } from './defaults';
import { getPricingPlanSortOrder } from './pricing';

const publicPricingText = JSON.stringify(defaultPricingPlans).toLowerCase();

describe('Mkety public pricing contract', () => {
  it('does not market ordinary plans with infrastructure/VPS promises or stale regional wording', () => {
    expect(publicPricingText).not.toContain('cpu');
    expect(publicPricingText).not.toContain('ram');
    expect(publicPricingText).not.toContain('vps');
    expect(publicPricingText).not.toContain('african edition');
  });

  it('keeps Trading explicitly Custom / Enterprise', () => {
    const enterprise = defaultPricingPlans.find((plan) => plan.key === 'enterprise');
    expect(enterprise?.features.join(' ')).toMatch(/Trading infrastructure/i);
    expect(enterprise?.priceLabel).toBe('Custom');
  });

  it('keeps deterministic commercial ordering', () => {
    expect(getPricingPlanSortOrder('starter')).toBe(10);
    expect(getPricingPlanSortOrder('ai-workspace')).toBe(20);
    expect(getPricingPlanSortOrder('automation-workspace')).toBe(30);
    expect(getPricingPlanSortOrder('deploy-workspace')).toBe(40);
    expect(getPricingPlanSortOrder('mkety-one')).toBe(50);
    expect(getPricingPlanSortOrder('enterprise')).toBe(60);
    expect(getPricingPlanSortOrder('growth')).toBe(1000);
  });
});
