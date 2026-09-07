import type { NormalizedSettlement } from '../domain/settlement';

export type BillingSettlementTransactionContext = {
  tenantId: string;
  subscriptionId: string;
  billingPeriodId: string;
  periodEnd: Date;
  amountDueMinor: bigint;
  currency: string;
};

export type BillingSettlementInsertResult = {
  settlementId: string;
  inserted: boolean;
};

export interface BillingSettlementTransaction {
  loadSettlementContext(input: NormalizedSettlement): Promise<BillingSettlementTransactionContext | null>;
  tryCreateVerifiedSettlement(
    input: NormalizedSettlement,
    context: BillingSettlementTransactionContext,
  ): Promise<BillingSettlementInsertResult>;
  appendPaymentLedgerEntry(
    settlementId: string,
    input: NormalizedSettlement,
    context: BillingSettlementTransactionContext,
  ): Promise<void>;
  markPeriodPaid(
    input: NormalizedSettlement,
    context: BillingSettlementTransactionContext,
  ): Promise<void>;
  advanceSubscriptionThroughPeriod(
    input: NormalizedSettlement,
    context: BillingSettlementTransactionContext,
  ): Promise<void>;
  markSettlementApplied(settlementId: string, appliedAt: Date): Promise<void>;
}

export async function applySettlementInsideTransaction(
  tx: BillingSettlementTransaction,
  input: NormalizedSettlement,
  appliedAt: Date,
): Promise<{ settlementId: string; applied: boolean }> {
  const context = await tx.loadSettlementContext(input);

  if (!context) {
    throw new Error('Billing period does not belong to the supplied subscription.');
  }

  if (input.amountExpectedMinor !== context.amountDueMinor) {
    throw new Error('Settlement expected amount does not match the Mkety billing period.');
  }

  if (input.currencyExpected !== context.currency || input.currencyPaid !== context.currency) {
    throw new Error('Settlement currency does not match the Mkety billing period.');
  }

  if (input.amountPaidMinor < context.amountDueMinor) {
    throw new Error('Settlement amount paid is below the Mkety billing amount due.');
  }

  const settlement = await tx.tryCreateVerifiedSettlement(input, context);

  if (!settlement.inserted) {
    return { settlementId: settlement.settlementId, applied: false };
  }

  await tx.appendPaymentLedgerEntry(settlement.settlementId, input, context);
  await tx.markPeriodPaid(input, context);
  await tx.advanceSubscriptionThroughPeriod(input, context);
  await tx.markSettlementApplied(settlement.settlementId, appliedAt);

  return { settlementId: settlement.settlementId, applied: true };
}
