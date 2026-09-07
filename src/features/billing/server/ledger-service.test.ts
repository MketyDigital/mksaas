import {
  type BillingLedgerRepository,
  type LedgerEntry,
  appendLedgerEntry,
  reverseLedgerEntry,
} from './ledger-service';

const payment: LedgerEntry = {
  id: 'ledger-1',
  tenantId: 'tenant-1',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  settlementId: 'settlement-1',
  entryType: 'payment',
  amountMinor: 1999n,
  currency: 'USD',
  reversalOfEntryId: null,
  reference: 'payment-123',
};

function makeRepository(existing: LedgerEntry | null = payment) {
  const appended: Omit<LedgerEntry, 'id'>[] = [];
  const repository: BillingLedgerRepository = {
    async append(input) {
      appended.push(input);
      return { ...input, id: `ledger-${appended.length + 1}` };
    },
    async findById(tenantId, entryId) {
      return existing?.tenantId === tenantId && existing.id === entryId ? existing : null;
    },
  };

  return { repository, appended };
}

describe('immutable billing ledger service', () => {
  it('appends a financial entry without exposing destructive mutation semantics', async () => {
    const { repository, appended } = makeRepository();

    const created = await appendLedgerEntry(repository, {
      tenantId: payment.tenantId,
      subscriptionId: payment.subscriptionId,
      billingPeriodId: payment.billingPeriodId,
      settlementId: payment.settlementId,
      entryType: payment.entryType,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reversalOfEntryId: null,
      reference: payment.reference,
    });

    expect(created.id).toBe('ledger-2');
    expect(appended).toHaveLength(1);
    expect(Object.keys(repository).sort()).toEqual(['append', 'findById']);
  });

  it('reverses an existing entry by appending an equal and opposite compensating entry', async () => {
    const { repository, appended } = makeRepository();

    const reversal = await reverseLedgerEntry(repository, payment.id, 'Customer payment was refunded.', {
      tenantId: payment.tenantId,
    });

    expect(reversal).toMatchObject({
      entryType: 'reversal',
      amountMinor: -1999n,
      currency: 'USD',
      reversalOfEntryId: payment.id,
      reference: 'Customer payment was refunded.',
    });
    expect(appended).toHaveLength(1);
  });

  it('fails closed for cross-tenant or missing originals', async () => {
    const { repository, appended } = makeRepository();

    await expect(
      reverseLedgerEntry(repository, payment.id, 'Wrong tenant attempt.', { tenantId: 'tenant-2' }),
    ).rejects.toThrow('Ledger entry not found for tenant.');
    expect(appended).toHaveLength(0);
  });

  it('requires an audit reason and refuses to reverse a reversal again', async () => {
    const { repository } = makeRepository();
    await expect(reverseLedgerEntry(repository, payment.id, '   ', { tenantId: payment.tenantId })).rejects.toThrow(
      'Ledger reversal reason is required.',
    );

    const alreadyReversal: LedgerEntry = {
      ...payment,
      id: 'ledger-reversal',
      entryType: 'reversal',
      amountMinor: -payment.amountMinor,
      reversalOfEntryId: payment.id,
    };
    const second = makeRepository(alreadyReversal);

    await expect(
      reverseLedgerEntry(second.repository, alreadyReversal.id, 'Reverse the reversal.', {
        tenantId: alreadyReversal.tenantId,
      }),
    ).rejects.toThrow('Reversal entries cannot be reversed directly.');
    expect(second.appended).toHaveLength(0);
  });
});
