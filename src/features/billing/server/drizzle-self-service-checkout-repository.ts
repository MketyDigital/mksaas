import { addMonths } from 'date-fns';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  billingCheckouts,
  billingPeriods,
  billingPlans,
  billingPlanVersions,
  billingSubscriptions,
} from '@/shared/db/schema';

import { getSelfServiceBillingPlan, getSelfServiceBillingQuote } from '../catalog/self-service-plans';
import type { SelfServiceCheckoutRepository } from './self-service-checkout';

export const drizzleSelfServiceCheckoutRepository: SelfServiceCheckoutRepository = {
  async prepareCheckout(input) {
    const catalogPlan = getSelfServiceBillingPlan(input.planKey);
    const quote = getSelfServiceBillingQuote(input.planKey, input.termKey);
    const quote = getSelfServiceBillingQuote(input.planKey, input.termKey);

    return db.transaction(async (tx) => {
      const [existingSubscription] = await tx
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(
          and(
            eq(billingSubscriptions.tenantId, input.tenantId),
            ne(billingSubscriptions.status, 'cancelled'),
          ),
        )
        .limit(1);

      if (existingSubscription) {
        throw new Error('This workspace already has a current Mkety subscription.');
      }

      const [activeVersion] = await tx
        .select({
          id: billingPlanVersions.id,
          amountMinor: billingPlanVersions.amountMinor,
          currency: billingPlanVersions.currency,
          billingInterval: billingPlanVersions.billingInterval,
        })
        .from(billingPlanVersions)
        .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
        .where(
          and(
            eq(billingPlans.key, input.planKey),
            eq(billingPlans.status, 'active'),
            eq(billingPlanVersions.isPublic, true),
            isNull(billingPlanVersions.effectiveTo),
          ),
        )
        .orderBy(desc(billingPlanVersions.version))
        .limit(1);

      if (!activeVersion) {
        throw new Error('The selected Mkety billing plan is not configured.');
      }

      if (
        activeVersion.amountMinor !== catalogPlan.amountMinor ||
        activeVersion.currency !== catalogPlan.currency ||
        activeVersion.billingInterval !== catalogPlan.billingInterval
      ) {
        throw new Error('The selected Mkety billing plan does not match the canonical commercial catalog.');
      }

      const periodStart = input.now;
      const periodEnd = addMonths(periodStart, quote.term.months);

      const [subscription] = await tx
        .insert(billingSubscriptions)
        .values({
          tenantId: input.tenantId,
          planVersionId: activeVersion.id,
          status: 'pending_payment',
          renewalMode: 'invoice_required',
          autoRenew: true,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          gatewayProvider: input.provider,
        })
        .returning({ id: billingSubscriptions.id });

      const [period] = await tx
        .insert(billingPeriods)
        .values({
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          periodStart,
          periodEnd,
          amountDueMinor: quote.amountMinor,
          currency: activeVersion.currency,
          collectionStatus: 'open',
          dueAt: input.now,
        })
        .returning({ id: billingPeriods.id });

      const [checkout] = await tx
        .insert(billingCheckouts)
        .values({
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          billingPeriodId: period.id,
          provider: input.provider,
          amountExpectedMinor: quote.amountMinor,
          currency: activeVersion.currency,
          status: 'created',
        })
        .returning({ id: billingCheckouts.id });

      return {
        checkoutId: checkout.id,
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        billingPeriodId: period.id,
        amountExpectedMinor: quote.amountMinor,
        currency: activeVersion.currency,
      };
    });
  },

  async markCheckoutReady(input) {
    await db
      .update(billingCheckouts)
      .set({
        providerCheckoutId: input.providerCheckoutId ?? null,
        checkoutUrl: input.checkoutUrl,
        expiresAt: input.expiresAt ?? null,
        status: 'redirected',
        updatedAt: input.updatedAt,
      })
      .where(eq(billingCheckouts.id, input.checkoutId));
  },

  async markCheckoutFailed(input) {
    await db.transaction(async (tx) => {
      await tx
        .update(billingCheckouts)
        .set({ status: 'failed', updatedAt: input.updatedAt })
        .where(eq(billingCheckouts.id, input.checkoutId));

      await tx
        .update(billingSubscriptions)
        .set({
          status: 'cancelled',
          cancelledAt: input.updatedAt,
          cancellationReason: 'checkout_provider_failure',
          updatedAt: input.updatedAt,
        })
        .where(eq(billingSubscriptions.id, input.subscriptionId));
    });
  },
};
