import { and, desc, eq, inArray } from 'drizzle-orm';

import { drizzleEntitlementSource } from '@/features/entitlements/server/drizzle-source';

import { db } from '@/shared/db/cloudflare';
import { billingPlans, billingPlanVersions, billingSubscriptions } from '@/shared/db/schema';

import { isMailPlanKey, type MailPlanKey, normalizeMailPlanKey } from '../commercial/plans';


export async function resolveTenantMailPlanKey(
  tenantId: string,
  fallbackPlanKey?: string | null,
): Promise<MailPlanKey> {
  const currentPlanVersionIds = await drizzleEntitlementSource.getCurrentPlanVersionIds(tenantId);
  if (!currentPlanVersionIds.length) return normalizeMailPlanKey(fallbackPlanKey);

  const [subscription] = await db
    .select({ planKey: billingPlans.key })
    .from(billingSubscriptions)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .where(
      and(
        eq(billingSubscriptions.tenantId, tenantId),
        inArray(billingSubscriptions.planVersionId, currentPlanVersionIds),
        inArray(billingPlans.key, ['mail-starter', 'mail-growth', 'mail-business']),
      ),
    )
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);

  if (subscription?.planKey && isMailPlanKey(subscription.planKey)) return subscription.planKey;
  return normalizeMailPlanKey(fallbackPlanKey);
}
