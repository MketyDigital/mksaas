import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/shared/db';
import { billingPlans, billingPlanVersions } from '@/shared/db/schema';

import {
  getSelfServiceBillingPlan,
  getSelfServiceBillingTerm,
  isSelfServiceBillingPlanKey,
  SELF_SERVICE_BILLING_PLANS,
  type SelfServiceBillingPlanKey,
  type SelfServiceBillingTermKey,
} from '../catalog/self-service-plans';

export function calculateSelfServiceTermQuote(
  monthlyAmountMinor: bigint,
  termKey: SelfServiceBillingTermKey,
) {
  const term = getSelfServiceBillingTerm(termKey);
  const undiscountedMinor = monthlyAmountMinor * BigInt(term.months);
  const amountMinor =
    (undiscountedMinor * BigInt(100 - term.discountPercent) + 50n) / 100n;

  return {
    term,
    amountMinor,
    undiscountedMinor,
    savingsMinor: undiscountedMinor - amountMinor,
    effectiveMonthlyMinor:
      (amountMinor + BigInt(Math.floor(term.months / 2))) / BigInt(term.months),
  };
}

export async function getActiveSelfServiceBillingPlan(planKey: SelfServiceBillingPlanKey) {
  const bootstrap = getSelfServiceBillingPlan(planKey);
  const [active] = await db
    .select({
      planId: billingPlans.id,
      key: billingPlans.key,
      name: billingPlans.name,
      description: billingPlans.description,
      status: billingPlans.status,
      versionId: billingPlanVersions.id,
      version: billingPlanVersions.version,
      amountMinor: billingPlanVersions.amountMinor,
      currency: billingPlanVersions.currency,
      billingInterval: billingPlanVersions.billingInterval,
      isPublic: billingPlanVersions.isPublic,
      effectiveFrom: billingPlanVersions.effectiveFrom,
    })
    .from(billingPlanVersions)
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .where(
      and(
        eq(billingPlans.key, planKey),
        eq(billingPlans.status, 'active'),
        eq(billingPlanVersions.isPublic, true),
        isNull(billingPlanVersions.effectiveTo),
      ),
    )
    .orderBy(desc(billingPlanVersions.version))
    .limit(1);

  if (!active) {
    return {
      key: bootstrap.key,
      name: bootstrap.name,
      description: bootstrap.description,
      amountMinor: bootstrap.amountMinor,
      currency: bootstrap.currency,
      billingInterval: bootstrap.billingInterval,
      versionId: null,
      version: 0,
      effectiveFrom: null,
      source: 'bootstrap' as const,
    };
  }

  if (active.currency !== bootstrap.currency || active.billingInterval !== bootstrap.billingInterval) {
    throw new Error('Active billing plan currency or interval is not supported by self-service checkout.');
  }

  return {
    key: planKey,
    name: active.name,
    description: active.description ?? bootstrap.description,
    amountMinor: active.amountMinor,
    currency: active.currency as typeof bootstrap.currency,
    billingInterval: active.billingInterval as typeof bootstrap.billingInterval,
    versionId: active.versionId,
    version: active.version,
    effectiveFrom: active.effectiveFrom,
    source: 'database' as const,
  };
}

export async function getActiveSelfServiceBillingQuote(
  planKey: SelfServiceBillingPlanKey,
  termKey: SelfServiceBillingTermKey,
) {
  const plan = await getActiveSelfServiceBillingPlan(planKey);
  return {
    plan,
    ...calculateSelfServiceTermQuote(plan.amountMinor, termKey),
    currency: plan.currency,
  };
}

export async function getActiveSelfServicePlans(planKeys?: readonly SelfServiceBillingPlanKey[]) {
  const keys = planKeys ?? (Object.keys(SELF_SERVICE_BILLING_PLANS) as SelfServiceBillingPlanKey[]);
  const safeKeys = keys.filter((key): key is SelfServiceBillingPlanKey => isSelfServiceBillingPlanKey(key));
  return Promise.all(safeKeys.map((key) => getActiveSelfServiceBillingPlan(key)));
}
