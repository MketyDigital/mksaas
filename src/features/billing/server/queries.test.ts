import { getTenantBillingSummary, type BillingSummarySource } from './queries';

const source: BillingSummarySource = {
  async getCurrentBillingState(tenantId) {
    return tenantId === 'tenant-1'
      ? {
          planKey: 'pro',
          planName: 'Pro',
          planVersion: 3,
          amountDueMinor: 1999n,
          currency: 'USD',
          subscriptionStatus: 'active',
          renewalMode: 'manual',
          autoRenew: false,
          currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
          gracePeriodEnd: null,
          providerCustomerRef: 'secret-provider-customer-ref',
          providerSubscriptionRef: 'secret-provider-subscription-ref',
        }
      : null;
  },
  async getRecentLedgerEntries() {
    return [
      {
        id: 'ledger-1',
        entryType: 'payment',
        amountMinor: 1999n,
        currency: 'USD',
        createdAt: new Date('2026-09-07T12:00:00.000Z'),
        reference: 'internal-bank-reference',
      },
    ];
  },
  async getRecentSettlements() {
    return [
      {
        id: 'settlement-1',
        provider: 'nowpayments',
        amountPaidMinor: 1999n,
        currencyPaid: 'USD',
        status: 'applied',
        occurredAt: new Date('2026-09-07T12:00:00.000Z'),
        rawReference: 'raw-provider-payload-reference',
      },
    ];
  },
};

describe('getTenantBillingSummary', () => {
  it('returns the Mkety-owned tenant billing projection', async () => {
    await expect(getTenantBillingSummary(source, 'tenant-1')).resolves.toMatchObject({
      plan: { key: 'pro', name: 'Pro', version: 3 },
      subscription: { status: 'active', renewalMode: 'manual', autoRenew: false },
      currentPeriod: { amountDueMinor: 1999n, currency: 'USD' },
      recentLedger: [{ id: 'ledger-1', entryType: 'payment', amountMinor: 1999n, currency: 'USD' }],
      recentSettlements: [
        { id: 'settlement-1', provider: 'nowpayments', amountPaidMinor: 1999n, currencyPaid: 'USD', status: 'applied' },
      ],
    });
  });

  it('fails closed when the tenant has no current billing state', async () => {
    await expect(getTenantBillingSummary(source, 'tenant-2')).resolves.toBeNull();
  });

  it('does not expose provider account refs or raw financial references', async () => {
    const summary = await getTenantBillingSummary(source, 'tenant-1');
    const serialized = JSON.stringify(summary, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

    expect(serialized).not.toContain('secret-provider-customer-ref');
    expect(serialized).not.toContain('secret-provider-subscription-ref');
    expect(serialized).not.toContain('raw-provider-payload-reference');
    expect(serialized).not.toContain('internal-bank-reference');
    expect(serialized.toLowerCase()).not.toContain('secret');
  });
});
