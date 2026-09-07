import type { NormalizedSettlement } from '../domain/settlement';
import {
  applySettlementInsideTransaction,
  type BillingSettlementTransaction,
  type BillingSettlementTransactionContext,
} from './settlement-transaction';

const input: NormalizedSettlement = {
  provider: 'nowpayments',
  providerPaymentId: 'payment-123',
  providerEventId: 'event-123',
  subscriptionId: 'subscription-123',
  billingPeriodId: 'period-123',
  amountExpectedMinor: 1999n,
  currencyExpected: 'USD',
  amountPaidMinor: 1999n,
  currencyPaid: 'USD',
  status: 'verified_success',
  occurredAt: new Date('2026-09-07T12:00:00.000Z'),
};

const context: BillingSettlementTransactionContext = {
  tenantId: 'tenant-123',
  subscriptionId: input.subscriptionId,
  billingPeriodId: input.billingPeriodId,
  periodEnd: new Date('2026-10-07T12:00:00.000Z'),
  amountDueMinor: 1999n,
  currency: 'USD',
};

function makeTx(options?: { duplicate?: boolean; context?: BillingSettlementTransactionContext | null }) {
  const calls: string[] = [];
  const tx: BillingSettlementTransaction = {
    async loadSettlementContext() {
      calls.push('load-context');
      return options?.context === undefined ? context : options.context;
    },
    async tryCreateVerifiedSettlement() {
      calls.push('create-settlement');
      return options?.duplicate
        ? { settlementId: 'settlement-existing', inserted: false }
        : { settlementId: 'settlement-new', inserted: true };
    },
    async appendPaymentLedgerEntry() {
      calls.push('append-ledger');
    },
    async markPeriodPaid() {
      calls.push('mark-period-paid');
    },
    async advanceSubscriptionThroughPeriod() {
      calls.push('advance-subscription');
    },
    async markSettlementApplied() {
      calls.push('mark-settlement-applied');
    },
  };

  return { tx, calls };
}

describe('applySettlementInsideTransaction', () => {
  it('derives tenant and charge truth from Mkety period state before applying money', async () => {
    const { tx, calls } = makeTx();
    const appliedAt = new Date('2026-09-07T13:00:00.000Z');

    const result = await applySettlementInsideTransaction(tx, input, appliedAt);

    expect(result).toEqual({ settlementId: 'settlement-new', applied: true });
    expect(calls).toEqual([
      'load-context',
      'create-settlement',
      'append-ledger',
      'mark-period-paid',
      'advance-subscription',
      'mark-settlement-applied',
    ]);
  });

  it('returns a database-detected replay without mutating ledger or billing state twice', async () => {
    const { tx, calls } = makeTx({ duplicate: true });

    const result = await applySettlementInsideTransaction(tx, input, new Date());

    expect(result).toEqual({ settlementId: 'settlement-existing', applied: false });
    expect(calls).toEqual(['load-context', 'create-settlement']);
  });

  it('rejects an unknown or mismatched subscription-period pair', async () => {
    const { tx, calls } = makeTx({ context: null });

    await expect(applySettlementInsideTransaction(tx, input, new Date())).rejects.toThrow(
      'Billing period does not belong to the supplied subscription.',
    );
    expect(calls).toEqual(['load-context']);
  });

  it('rejects provider expected amount or currency that does not match Mkety billing truth', async () => {
    const wrongAmount = makeTx();
    await expect(
      applySettlementInsideTransaction(wrongAmount.tx, { ...input, amountExpectedMinor: 2000n }, new Date()),
    ).rejects.toThrow('Settlement expected amount does not match the Mkety billing period.');
    expect(wrongAmount.calls).toEqual(['load-context']);

    const wrongCurrency = makeTx();
    await expect(
      applySettlementInsideTransaction(wrongCurrency.tx, { ...input, currencyExpected: 'NGN', currencyPaid: 'NGN' }, new Date()),
    ).rejects.toThrow('Settlement currency does not match the Mkety billing period.');
    expect(wrongCurrency.calls).toEqual(['load-context']);
  });

  it('does not mark a billing period paid when the verified amount is below the amount due', async () => {
    const { tx, calls } = makeTx();

    await expect(
      applySettlementInsideTransaction(tx, { ...input, amountPaidMinor: 1998n }, new Date()),
    ).rejects.toThrow('Settlement amount paid is below the Mkety billing amount due.');
    expect(calls).toEqual(['load-context']);
  });
});
