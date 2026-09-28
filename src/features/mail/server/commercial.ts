import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { billingPlans, billingPlanVersions, billingSubscriptions } from '@/shared/db/schema';

import { type MailPlanKey, isMailPlanKey, normalizeMailPlanKey } from '../commercial/plans';

const QUALIFYING_MAIL_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancel_at_period_end',
] as const;

export async function resolveTenantMailPlanKey(
  tenantId: string,
  fallbackPlanKey?: string | null,
): Promise<MailPlanKey> {
  const [subscription] = await db
    .select({ planKey: billingPlans.key })
    .from(billingSubscriptions)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .where(
      and(
        eq(billingSubscriptions.tenantId, tenantId),
        inArray(billingSubscriptions.status, [...QUALIFYING_MAIL_SUBSCRIPTION_STATUSES]),
        inArray(billingPlans.key, ['mail-starter', 'mail-growth', 'mail-business']),
      ),
    )
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);

  if (subscription?.planKey && isMailPlanKey(subscription.planKey)) return subscription.planKey;
  return normalizeMailPlanKey(fallbackPlanKey);
}
