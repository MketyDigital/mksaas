import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  billingLedgerEntries,
  billingPeriods,
  billingPlans,
  billingPlanVersions,
  billingSettlements,
  billingSubscriptions,
} from '@/shared/db/schema';

import type { RenewalMode, SubscriptionStatus } from '../domain/types';
import type { BillingSummarySource } from './queries';

const CURRENT_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancel_at_period_end',
] as const;

export const drizzleBillingSummarySource: BillingSummarySource = {
  async getCurrentBillingState(tenantId) {
    const [subscription] = await db
      .select({
        id: billingSubscriptions.id,
        planKey: billingPlans.key,
        planName: billingPlans.name,
        planVersion: billingPlanVersions.version,
        subscriptionStatus: billingSubscriptions.status,
        renewalMode: billingSubscriptions.renewalMode,
        autoRenew: billingSubscriptions.autoRenew,
        currentPeriodStart: billingSubscriptions.currentPeriodStart,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
        gracePeriodEnd: billingSubscriptions.gracePeriodEnd,
        providerCustomerRef: billingSubscriptions.providerCustomerRef,
        providerSubscriptionRef: billingSubscriptions.providerSubscriptionRef,
      })
      .from(billingSubscriptions)
      .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
      .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
      .where(
        and(
          eq(billingSubscriptions.tenantId, tenantId),
          inArray(billingSubscriptions.status, [...CURRENT_SUBSCRIPTION_STATUSES]),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1);

    if (!subscription) return null;

    const [period] = await db
      .select({
        amountDueMinor: billingPeriods.amountDueMinor,
        currency: billingPeriods.currency,
        periodStart: billingPeriods.periodStart,
        periodEnd: billingPeriods.periodEnd,
      })
      .from(billingPeriods)
      .where(
        and(
          eq(billingPeriods.tenantId, tenantId),
          eq(billingPeriods.subscriptionId, subscription.id),
        ),
      )
      .orderBy(desc(billingPeriods.periodEnd))
      .limit(1);

    if (!period) return null;

    return {
      planKey: subscription.planKey,
      planName: subscription.planName,
      planVersion: subscription.planVersion,
      amountDueMinor: period.amountDueMinor,
      currency: period.currency,
      subscriptionStatus: subscription.subscriptionStatus as SubscriptionStatus,
      renewalMode: subscription.renewalMode as RenewalMode,
      autoRenew: subscription.autoRenew,
      currentPeriodStart: subscription.currentPeriodStart ?? period.periodStart,
      currentPeriodEnd: subscription.currentPeriodEnd ?? period.periodEnd,
      gracePeriodEnd: subscription.gracePeriodEnd,
      providerCustomerRef: subscription.providerCustomerRef,
      providerSubscriptionRef: subscription.providerSubscriptionRef,
    };
  },

  async getRecentLedgerEntries(tenantId) {
    return db
      .select({
        id: billingLedgerEntries.id,
        entryType: billingLedgerEntries.entryType,
        amountMinor: billingLedgerEntries.amountMinor,
        currency: billingLedgerEntries.currency,
        createdAt: billingLedgerEntries.createdAt,
        reference: billingLedgerEntries.reference,
      })
      .from(billingLedgerEntries)
      .where(eq(billingLedgerEntries.tenantId, tenantId))
      .orderBy(desc(billingLedgerEntries.createdAt))
      .limit(10);
  },

  async getRecentSettlements(tenantId) {
    return db
      .select({
        id: billingSettlements.id,
        provider: billingSettlements.provider,
        amountPaidMinor: billingSettlements.amountPaidMinor,
        currencyPaid: billingSettlements.currencyPaid,
        status: billingSettlements.status,
        occurredAt: billingSettlements.occurredAt,
        rawReference: billingSettlements.rawReference,
      })
      .from(billingSettlements)
      .where(eq(billingSettlements.tenantId, tenantId))
      .orderBy(desc(billingSettlements.occurredAt))
      .limit(10);
  },
};
