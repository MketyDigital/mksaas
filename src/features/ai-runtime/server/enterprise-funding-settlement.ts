import { and, eq, or, sql } from 'drizzle-orm';

import { grantCredits } from '@/features/usage-credits/server/service';
import { db } from '@/shared/db';
import {
  aiEnterpriseCommercialPolicies,
  billingCheckouts,
  billingLedgerEntries,
  billingPeriods,
  billingPlanVersionCreditAllowances,
  billingSettlements,
  billingSubscriptions,
} from '@/shared/db/schema';

export async function applyEnterpriseAiFundingSettlement(input: {
  checkoutId: string;
  provider: string;
  providerPaymentId: string;
  providerEventId: string;
  providerAmountPaidMinor: bigint;
  providerCurrencyPaid: string;
  rawReference: string;
  occurredAt: Date;
}) {
  const applied = await db.transaction(async (tx) => {
    const checkout = await tx.query.billingCheckouts.findFirst({
      where: eq(billingCheckouts.id, input.checkoutId),
    });
    if (!checkout || checkout.purpose !== 'enterprise_ai_funding') {
      throw new Error('Enterprise AI funding checkout was not found.');
    }
    if (checkout.provider !== input.provider) throw new Error('Enterprise AI funding provider mismatch.');
    const expectedProviderCurrency = checkout.providerCurrency ?? checkout.currency;
    const expectedProviderAmount = checkout.providerAmountExpectedMinor ?? checkout.amountExpectedMinor;
    if (input.providerCurrencyPaid !== expectedProviderCurrency || input.providerAmountPaidMinor < expectedProviderAmount) {
      throw new Error('Provider settlement does not match the Enterprise AI funding quote.');
    }

    const period = await tx.query.billingPeriods.findFirst({
      where: and(
        eq(billingPeriods.id, checkout.billingPeriodId),
        eq(billingPeriods.subscriptionId, checkout.subscriptionId),
        eq(billingPeriods.tenantId, checkout.tenantId),
      ),
    });
    if (!period) throw new Error('Enterprise AI billing period was not found.');

    const subscription = await tx.query.billingSubscriptions.findFirst({
      where: and(
        eq(billingSubscriptions.id, checkout.subscriptionId),
        eq(billingSubscriptions.tenantId, checkout.tenantId),
      ),
    });
    if (!subscription) throw new Error('Enterprise AI subscription was not found.');

    const [inserted] = await tx.insert(billingSettlements).values({
      tenantId: checkout.tenantId,
      subscriptionId: checkout.subscriptionId,
      billingPeriodId: checkout.billingPeriodId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      providerEventId: input.providerEventId,
      settlementType: 'enterprise_ai_funding',
      amountExpectedMinor: checkout.amountExpectedMinor,
      currencyExpected: checkout.currency,
      amountPaidMinor: checkout.amountExpectedMinor,
      currencyPaid: checkout.currency,
      providerAmountPaidMinor: input.providerAmountPaidMinor,
      providerCurrencyPaid: input.providerCurrencyPaid,
      status: 'applied',
      rawReference: input.rawReference,
      occurredAt: input.occurredAt,
      verifiedAt: input.occurredAt,
      appliedAt: input.occurredAt,
    }).onConflictDoNothing().returning({ id: billingSettlements.id });

    if (!inserted) {
      const replay = await tx.query.billingSettlements.findFirst({
        where: or(
          and(eq(billingSettlements.provider, input.provider), eq(billingSettlements.providerEventId, input.providerEventId)),
          and(eq(billingSettlements.provider, input.provider), eq(billingSettlements.providerPaymentId, input.providerPaymentId), eq(billingSettlements.settlementType, 'enterprise_ai_funding')),
        ),
        columns: { id: true },
      });
      if (!replay) throw new Error('Enterprise AI funding settlement conflicted without a replay identity.');
      const allowance = await tx.query.billingPlanVersionCreditAllowances.findFirst({
        where: and(
          eq(billingPlanVersionCreditAllowances.planVersionId, subscription.planVersionId),
          eq(billingPlanVersionCreditAllowances.grantInterval, 'billing_period'),
        ),
      });
      const policy = await tx.query.aiEnterpriseCommercialPolicies.findFirst({
        where: eq(aiEnterpriseCommercialPolicies.planVersionId, subscription.planVersionId),
      });
      if (!policy || policy.fundingMode !== 'prepaid_partial') {
        throw new Error('Enterprise AI partial funding policy is unavailable.');
      }
      const credits = allowance?.creditAmount && period.amountDueMinor > 0n
        ? (allowance.creditAmount * checkout.amountExpectedMinor) / period.amountDueMinor
        : 0n;
      return {
        applied: true as const,
        settlementId: replay.id,
        credits,
        tenantId: checkout.tenantId,
        billingPeriodId: checkout.billingPeriodId,
      };
    }

    await tx.insert(billingLedgerEntries).values({
      tenantId: checkout.tenantId,
      subscriptionId: checkout.subscriptionId,
      billingPeriodId: checkout.billingPeriodId,
      settlementId: inserted.id,
      entryType: 'payment',
      amountMinor: checkout.amountExpectedMinor,
      currency: checkout.currency,
      reference: input.rawReference || input.providerPaymentId,
    });

    const [{ fundedMinor }] = await tx.select({
      fundedMinor: sql<bigint>`coalesce(sum(${billingSettlements.amountPaidMinor}), 0)::bigint`,
    }).from(billingSettlements).where(and(
      eq(billingSettlements.billingPeriodId, checkout.billingPeriodId),
      eq(billingSettlements.settlementType, 'enterprise_ai_funding'),
      eq(billingSettlements.status, 'applied'),
    ));

    const funded = fundedMinor ?? checkout.amountExpectedMinor;
    await tx.update(billingPeriods).set({
      collectionStatus: funded >= period.amountDueMinor ? 'paid' : 'partial',
      updatedAt: input.occurredAt,
    }).where(eq(billingPeriods.id, period.id));

    await tx.update(billingSubscriptions).set({
      status: 'active',
      currentPeriodEnd: period.periodEnd,
      gracePeriodEnd: null,
      updatedAt: input.occurredAt,
    }).where(eq(billingSubscriptions.id, subscription.id));

    await tx.update(billingCheckouts).set({
      status: 'completed',
      updatedAt: input.occurredAt,
    }).where(eq(billingCheckouts.id, checkout.id));

    const allowance = await tx.query.billingPlanVersionCreditAllowances.findFirst({
      where: and(
        eq(billingPlanVersionCreditAllowances.planVersionId, subscription.planVersionId),
        eq(billingPlanVersionCreditAllowances.grantInterval, 'billing_period'),
      ),
    });
    const policy = await tx.query.aiEnterpriseCommercialPolicies.findFirst({
      where: eq(aiEnterpriseCommercialPolicies.planVersionId, subscription.planVersionId),
    });
    if (!policy || policy.fundingMode !== 'prepaid_partial') {
      throw new Error('Enterprise AI partial funding policy is unavailable.');
    }

    const credits = allowance?.creditAmount && period.amountDueMinor > 0n
      ? (allowance.creditAmount * checkout.amountExpectedMinor) / period.amountDueMinor
      : 0n;

    return {
      applied: true as const,
      settlementId: inserted.id,
      credits,
      tenantId: checkout.tenantId,
      billingPeriodId: checkout.billingPeriodId,
    };
  });

  if (applied.applied && applied.credits > 0n) {
    await grantCredits({
      tenantId: applied.tenantId,
      credits: applied.credits,
      idempotencyKey: `enterprise-ai-funding:${applied.settlementId}`,
      entryType: 'purchased_grant',
      source: 'enterprise_ai_verified_funding',
      billingPeriodId: applied.billingPeriodId,
      reason: 'Verified Enterprise AI prepaid funding.',
    });
  }

  return applied;
}
