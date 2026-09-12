import { normalizeNowPaymentsSettlement } from './nowpayments';

const basePayload = {
  verified: true,
  eventId: 'evt-now-1',
  paymentId: 'pay-now-1',
  paymentStatus: 'finished',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  amountExpectedMinor: '1999',
  currencyExpected: 'USD',
  amountPaidMinor: '1999',
  currencyPaid: 'USD',
  occurredAt: '2026-09-07T12:00:00.000Z',
};

describe('normalizeNowPaymentsSettlement', () => {
  it('accepts only a verified final finished event as a settlement candidate', () => {
    expect(normalizeNowPaymentsSettlement({ provider: 'nowpayments', payload: basePayload })).toMatchObject({
      provider: 'nowpayments',
      providerEventId: 'evt-now-1',
      providerPaymentId: 'pay-now-1',
      amountExpectedMinor: 1999n,
      amountPaidMinor: 1999n,
      status: 'verified_success',
    });
  });

  it.each(['confirmed', 'sending', 'partially_paid', 'waiting', 'unknown'])('rejects non-final status %s', (paymentStatus) => {
    expect(() => normalizeNowPaymentsSettlement({
      provider: 'nowpayments',
      payload: { ...basePayload, paymentStatus },
    })).toThrow('finished');
  });

  it('rejects an event that has not passed signature verification', () => {
    expect(() => normalizeNowPaymentsSettlement({
      provider: 'nowpayments',
      payload: { ...basePayload, verified: false },
    })).toThrow('verified');
  });
});
