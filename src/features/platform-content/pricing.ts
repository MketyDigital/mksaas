export const MKETY_PRICING_PLAN_ORDER = {
  starter: 10,
  'ai-workspace': 20,
  'automation-workspace': 30,
  'deploy-workspace': 40,
  'mkety-one': 50,
  enterprise: 60,
} as const;

export function getPricingPlanSortOrder(key: string): number {
  return MKETY_PRICING_PLAN_ORDER[key as keyof typeof MKETY_PRICING_PLAN_ORDER] ?? 1000;
}
