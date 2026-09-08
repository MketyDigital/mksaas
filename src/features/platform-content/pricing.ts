export const MKETY_PRICING_PLAN_ORDER = {
  starter: 10,
  growth: 20,
  enterprise: 30,
} as const;

export function getPricingPlanSortOrder(key: string): number {
  return MKETY_PRICING_PLAN_ORDER[key as keyof typeof MKETY_PRICING_PLAN_ORDER] ?? 1000;
}
