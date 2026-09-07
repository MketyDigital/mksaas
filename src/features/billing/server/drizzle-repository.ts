import { and, eq, isNull, lte, or } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import {
  billingLedgerEntries,
  billingPeriods,
  billingSettlements,
  billingSubscriptions,
} from '@/shared/db/schema';

import type { NormalizedSettlement } from '../domain/settlement';
import type { BillingRepository } from './repository';
import {
  applySettlementInsideTransaction,
  type BillingSettlementTransaction,
} from './settlement-transaction';

type DrizzleBillingDatabase = Pick<Database, 'transaction'>;
type DrizzleBillingTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

function createSettlementTransaction(tx: DrizzleBillingTransaction): BillingSettlementTransaction {
  return {
    async loadSettlementContext(input) {
      const period = await tx.query.billingPeriods.findFirst({
        where: and(
          eq(billingPeriods.id, input.billingPeriodId),
          eq(billingPeriods.subscriptionId, input.subscriptionId),
        ),
      });

      if (!period) return null;

      return {
        tenantId: period.tenantId,
        subscriptionId: period.subscriptionId,
        billingPeriodId: period.id,
        periodEnd: period.periodEnd,
        amountDueMinor: period.amountDueMinor,
        currency: period.currency,
      };
    },

    async tryCreateVerifiedSettlement(input, context) {
      if (!input.providerEventId && !input.providerPaymentId) {
        throw new Error('Settlement requires a provider event or payment identity.');
      }

      const [inserted] = await tx
        .insert(billingSettlements)
        .values({
          tenantId: context.tenantId,
          subscriptionId: context.subscriptionId,
          billingPeriodId: context.billingPeriodId,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId ?? null,
          providerEventId: input.providerEventId ?? null,
          settlementType: 'payment',
          amountExpectedMinor: context.amountDueMinor,
          currencyExpected: context.currency,
          amountPaidMinor: input.amountPaidMinor,
          currencyPaid: input.currencyPaid,
          status: 'verified',
          rawReference: input.rawReference ?? null,
          occurredAt: input.occurredAt,
          verifiedAt: input.occurredAt,
        })
        .onConflictDoNothing()
        .returning({ id: billingSettlements.id });

      if (inserted) {
        return { settlementId: inserted.id, inserted: true };
      }

      const eventIdentity = input.providerEventId
        ? and(
            eq(billingSettlements.provider, input.provider),
            eq(billingSettlements.providerEventId, input.providerEventId),
          )
        : undefined;
      const paymentIdentity = input.providerPaymentId
        ? and(
            eq(billingSettlements.provider, input.provider),
            eq(billingSettlements.providerPaymentId, input.providerPaymentId),
            eq(billingSettlements.settlementType, 'payment'),
          )
        : undefined;

      const replay = await tx.query.billingSettlements.findFirst({
        columns: { id: true },
        where:
          eventIdentity && paymentIdentity
            ? or(eventIdentity, paymentIdentity)
            : (eventIdentity ?? paymentIdentity),
      });

      if (!replay) {
        throw new Error('Settlement insert conflicted without a matching replay identity.');
      }

      return { settlementId: replay.id, inserted: false };
    },

    async appendPaymentLedgerEntry(settlementId, input, context) {
      await tx.insert(billingLedgerEntries).values({
        tenantId: context.tenantId,
        subscriptionId: context.subscriptionId,
        billingPeriodId: context.billingPeriodId,
        settlementId,
        entryType: 'payment',
        amountMinor: input.amountPaidMinor,
        currency: context.currency,
        reference: input.rawReference ?? input.providerPaymentId ?? input.providerEventId ?? null,
      });
    },

    async markPeriodPaid(input, context) {
      await tx
        .update(billingPeriods)
        .set({ collectionStatus: 'paid', updatedAt: input.occurredAt })
        .where(
          and(
            eq(billingPeriods.id, context.billingPeriodId),
            eq(billingPeriods.subscriptionId, context.subscriptionId),
          ),
        );
    },

    async advanceSubscriptionThroughPeriod(input, context) {
      await tx
        .update(billingSubscriptions)
        .set({
          status: 'active',
          currentPeriodEnd: context.periodEnd,
          gracePeriodEnd: null,
          updatedAt: input.occurredAt,
        })
        .where(
          and(
            eq(billingSubscriptions.id, context.subscriptionId),
            eq(billingSubscriptions.tenantId, context.tenantId),
            or(
              isNull(billingSubscriptions.currentPeriodEnd),
              lte(billingSubscriptions.currentPeriodEnd, context.periodEnd),
            ),
          ),
        );
    },

    async markSettlementApplied(settlementId, appliedAt) {
      await tx
        .update(billingSettlements)
        .set({ status: 'applied', appliedAt })
        .where(eq(billingSettlements.id, settlementId));
    },
  };
}

export function createDrizzleBillingRepository(database: DrizzleBillingDatabase): BillingRepository {
  return {
    applyVerifiedSettlementAtomically(input: NormalizedSettlement, appliedAt: Date) {
      return database.transaction(async (tx) =>
        applySettlementInsideTransaction(createSettlementTransaction(tx), input, appliedAt),
      );
    },
  };
}
