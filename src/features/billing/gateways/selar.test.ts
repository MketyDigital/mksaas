import { normalizeSelarSettlement } from './selar';

const basePayload = {
  verified: true,
  eventId: 'evt-selar-1',
  paymentId: 'pay-selar-1',
  status: 'successful',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  amountExpectedMinor: '1999',
  currencyExpected: 'USD',
  amountPaidMinor: '1999',
  currencyPaid: 'USD',
  occurredAt: '2026-09-07T12:00:00.000Z',
};

describe('normalizeSelarSettlement', () => {
  it('normalizes a verified successful provider event without provider-specific DB writes', () => {
    expect(normalizeSelarSettlement({ provider: 'selar', payload: basePayload })).toMatchObject({
      provider: 'selar',
      providerEventId: 'evt-selar-1',
      providerPaymentId: 'pay-selar-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1999n,
      amountPaidMinor: 1999n,
      currencyExpected: 'USD',
      currencyPaid: 'USD',
      status: 'verified_success',
    });
  });

  it('refuses browser-success or otherwise unverified payloads as proof of payment', () => {
    expect(() => normalizeSelarSettlement({
      provider: 'selar',
      payload: { ...basePayload, verified: false },
    })).toThrow('verified');
  });

  it('refuses non-successful payment status', () => {
    expect(() => normalizeSelarSettlement({
      provider: 'selar',
      payload: { ...basePayload, status: 'pending' },
    })).toThrow('successful');
  });
});
