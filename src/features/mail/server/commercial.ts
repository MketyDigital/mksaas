import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import { drizzleEntitlementSource } from '@/features/entitlements/server/drizzle-source';

import { db } from '@/shared/db/cloudflare';
import { billingPlans, billingPlanVersions, billingSubscriptions, mailEnterpriseOffers } from '@/shared/db/schema';

import { getFirstPartyMailTenantId } from './runtime-config';
import { parseMailPlanLimits } from '../commercial/enterprise-offers';
import { getMailCommercialPlan, isMailPlanKey, type MailPlanKey, normalizeMailPlanKey } from '../commercial/plans';

export const MAIL_INTERNAL_CUSTOM_PROFILE_KEY = 'mail-internal-custom' as const;
export const MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY = 'mail-enterprise-custom' as const;

export type MailWorkspacePlanKey = MailPlanKey | typeof MAIL_INTERNAL_CUSTOM_PROFILE_KEY | typeof MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY;

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

  const activeMailOffer = await db.query.mailEnterpriseOffers.findFirst({
    where: and(
      eq(mailEnterpriseOffers.tenantId, tenantId),
      eq(mailEnterpriseOffers.status, 'active'),
      or(isNull(mailEnterpriseOffers.endsAt), gt(mailEnterpriseOffers.endsAt, new Date())),
    ),
  });
  if (activeMailOffer) return MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY;
  if (fallbackPlanKey === MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY) return MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY;

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

export async function resolveTenantMailPlanLimits(tenantId: string, planKey: MailWorkspacePlanKey) {
  if (planKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY) return null;
  if (planKey === MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY) {
    const offer = await db.query.mailEnterpriseOffers.findFirst({
      where: and(
        eq(mailEnterpriseOffers.tenantId, tenantId),
        eq(mailEnterpriseOffers.status, 'active'),
        or(isNull(mailEnterpriseOffers.endsAt), gt(mailEnterpriseOffers.endsAt, new Date())),
      ),
    });
    if (!offer) throw new Error('Active Mail Enterprise offer is missing; Mail limits are unavailable.');
    return parseMailPlanLimits(offer.limits);
  }
  return getMailCommercialPlan(planKey).limits;
}

export async function resolveTenantMailPlanDisplay(tenantId: string, planKey: MailWorkspacePlanKey) {
  if (planKey === MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY) {
    const offer = await db.query.mailEnterpriseOffers.findFirst({
      where: and(
        eq(mailEnterpriseOffers.tenantId, tenantId),
        eq(mailEnterpriseOffers.status, 'active'),
        or(isNull(mailEnterpriseOffers.endsAt), gt(mailEnterpriseOffers.endsAt, new Date())),
      ),
    });
    if (!offer) throw new Error('Active Mail Enterprise offer is missing.');
    return { name: offer.name, amountMinor: offer.amountMinor, currency: offer.currency };
  }
  if (planKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY) {
    return { name: 'Internal Custom', amountMinor: null, currency: 'USD' } as const;
  }
  const plan = getMailCommercialPlan(planKey);
  return { name: plan.name, amountMinor: plan.amountMinor, currency: plan.currency };
}
