import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  billingPlanVersionEntitlements,
  billingSubscriptions,
  tenantEntitlementOverrides,
} from '@/shared/db/schema';

import type { EntitlementSource } from './resolver';

const QUALIFYING_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancel_at_period_end',
] as const;

export const drizzleEntitlementSource: EntitlementSource = {
  async getCurrentPlanVersionId(tenantId) {
    const [subscription] = await db
      .select({ planVersionId: billingSubscriptions.planVersionId })
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.tenantId, tenantId),
          inArray(billingSubscriptions.status, [...QUALIFYING_SUBSCRIPTION_STATUSES]),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1);

    return subscription?.planVersionId ?? null;
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
