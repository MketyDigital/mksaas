import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  billingPlanVersionEntitlements,
  billingSubscriptions,
  tenantEntitlementOverrides,
} from '@/shared/db/schema';

import type { EntitlementSource } from './resolver';

const CURRENT_ACCESS_STATUSES = ['trialing', 'active'] as const;

export const drizzleEntitlementSource: EntitlementSource = {
  async getCurrentPlanVersionIds(tenantId, now = new Date()) {
    const subscriptions = await db
      .select({ planVersionId: billingSubscriptions.planVersionId })
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.tenantId, tenantId),
          or(
            and(
              inArray(billingSubscriptions.status, [...CURRENT_ACCESS_STATUSES]),
              or(
                isNull(billingSubscriptions.currentPeriodEnd),
                gt(billingSubscriptions.currentPeriodEnd, now),
              ),
            ),
            and(
              eq(billingSubscriptions.status, 'cancel_at_period_end'),
              gt(billingSubscriptions.currentPeriodEnd, now),
            ),
            and(
              eq(billingSubscriptions.status, 'past_due'),
              gt(billingSubscriptions.gracePeriodEnd, now),
            ),
          ),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt));

    return [...new Set(subscriptions.map((subscription) => subscription.planVersionId))];
  },

  async getPlanEntitlements(planVersionId) {
    return db
      .select({
        entitlementKey: billingPlanVersionEntitlements.entitlementKey,
        enabled: billingPlanVersionEntitlements.enabled,
      })
      .from(billingPlanVersionEntitlements)
      .where(eq(billingPlanVersionEntitlements.planVersionId, planVersionId));
  },

  async getTenantOverrides(tenantId) {
    return db
      .select({
        entitlementKey: tenantEntitlementOverrides.entitlementKey,
        effect: tenantEntitlementOverrides.effect,
        expiresAt: tenantEntitlementOverrides.expiresAt,
      })
      .from(tenantEntitlementOverrides)
      .where(eq(tenantEntitlementOverrides.tenantId, tenantId));
  },
};
