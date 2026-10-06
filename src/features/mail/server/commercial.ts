import { and, desc, eq, inArray } from 'drizzle-orm';

import { drizzleEntitlementSource } from '@/features/entitlements/server/drizzle-source';

import { db } from '@/shared/db/cloudflare';
import { billingPlans, billingPlanVersions, billingSubscriptions } from '@/shared/db/schema';

import { getFirstPartyMailTenantId } from './runtime-config';
import { isMailPlanKey, type MailPlanKey, normalizeMailPlanKey } from '../commercial/plans';

export const MAIL_INTERNAL_CUSTOM_PROFILE_KEY = 'mail-internal-custom' as const;

export type MailWorkspacePlanKey = MailPlanKey | typeof MAIL_INTERNAL_CUSTOM_PROFILE_KEY;

export async function resolveTenantMailPlanKey(
  tenantId: string,
  fallbackPlanKey?: string | null,
  tenantSlug?: string | null,
): Promise<MailWorkspacePlanKey> {
  if (fallbackPlanKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY) {
    const configuredTenantId = getFirstPartyMailTenantId().trim();
    if (!tenantSlug) {
      throw new Error('Internal custom Mail profiles must use the reserved-tenant profile resolver.');
    }
    if (tenantId !== configuredTenantId || tenantSlug !== 'mkety-ops') {
      throw new Error('Internal custom Mail profile is restricted to the configured /mkety-ops tenant.');
    }
    return MAIL_INTERNAL_CUSTOM_PROFILE_KEY;
  }

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
