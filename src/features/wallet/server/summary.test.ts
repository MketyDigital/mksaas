import { readTenantWalletSummary, type WalletReadSource } from './summary';

function source(): WalletReadSource {
  return {
    getBillingSummary: jest.fn().mockResolvedValue({
      plan: { key: 'starter', name: 'Starter', version: 1 },
      subscription: { status: 'active', renewalMode: 'manual', autoRenew: false, gracePeriodEnd: null },
      currentPeriod: {
        start: new Date('2026-09-01T00:00:00.000Z'),
        end: new Date('2026-10-01T00:00:00.000Z'),
        amountDueMinor: 599n,
        currency: 'USD',
      },
      recentLedger: [
        { id: 'ledger-1', entryType: 'payment', amountMinor: 599n, currency: 'USD', createdAt: new Date() },
      ],
      recentSettlements: [
        {
          id: 'settlement-1',
          provider: 'nowpayments',
          amountPaidMinor: 599n,
          currencyPaid: 'USD',
          status: 'applied',
          occurredAt: new Date(),
        },
      ],
    }),
    getProductCreditBalance: jest.fn().mockResolvedValue({
      tenantId: 'tenant-1',
      availableCredits: 40n,
      lifetimeGranted: 100n,
      lifetimeConsumed: 60n,
    }),
  };
}

describe('Wallet read model', () => {
  it('keeps commercial Billing state and product credits explicitly separate', async () => {
    const storage = source();

    const wallet = await readTenantWalletSummary(storage, 'tenant-1');

    expect(wallet.billing?.currentPeriod.amountDueMinor).toBe(599n);
    expect(wallet.billing?.recentSettlements[0]?.amountPaidMinor).toBe(599n);
    expect(wallet.productCredits?.availableCredits).toBe(40n);
    expect(wallet).not.toHaveProperty('cashBalance');
    expect(wallet).not.toHaveProperty('storedValueBalance');
  });

  it('scopes every read to the supplied tenant', async () => {
    const storage = source();

    await readTenantWalletSummary(storage, 'tenant-42');

    expect(storage.getBillingSummary).toHaveBeenCalledWith('tenant-42');
    expect(storage.getProductCreditBalance).toHaveBeenCalledWith('tenant-42');
  });

  it('does not require an active billing record to expose product credits', async () => {
    const storage = source();
    jest.mocked(storage.getBillingSummary).mockResolvedValue(null);

    const wallet = await readTenantWalletSummary(storage, 'tenant-1');

    expect(wallet.billing).toBeNull();
    expect(wallet.productCredits?.availableCredits).toBe(40n);
  });
});
