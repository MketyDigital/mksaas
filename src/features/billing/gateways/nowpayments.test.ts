import {
  buildNowPaymentsSettlementForCheckout,
  createNowPaymentsBillingAdapter,
  normalizeNowPaymentsSettlement,
  parseMketyBillingOrderId,
} from './nowpayments';

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

describe('NOWPayments Billing adapter', () => {
  it('creates a fixed-price Mkety invoice using the checkout identity', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      async json() {
        return {
          id: 12345,
          invoice_url: 'https://nowpayments.io/payment/?iid=12345',
        };
      },
    } as Response);

    const adapter = createNowPaymentsBillingAdapter({
      apiKey: 'test-api-key',
      ipnSecret: 'test-ipn-secret',
      fetchImpl,
      webhookUrl: 'https://mkety.example/api/webhooks/billing/nowpayments',
    });

    const result = await adapter.createCheckout({
      checkoutId: '6fdd16e0-b8a3-4f8d-9f74-3d9157320189',
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1699n,
      currency: 'USD',
      returnUrl: 'https://mkety.example/return',
      cancelUrl: 'https://mkety.example/cancel',
    });

    expect(result).toMatchObject({
      provider: 'nowpayments',
      providerCheckoutId: '12345',
      checkoutUrl: 'https://nowpayments.io/payment/?iid=12345',
    });

    const request = fetchImpl.mock.calls[0];
    expect(request[0]).toBe('https://api.nowpayments.io/v1/invoice');
    const body = JSON.parse(request[1].body);
    expect(body).toMatchObject({
      price_amount: 16.99,
      price_currency: 'usd',
      order_id: 'MKBILL-6fdd16e0-b8a3-4f8d-9f74-3d9157320189',
      ipn_callback_url: 'https://mkety.example/api/webhooks/billing/nowpayments',
      success_url: 'https://mkety.example/return',
      cancel_url: 'https://mkety.example/cancel',
    });
  });

  it('parses only Mkety Billing checkout order identifiers', () => {
    expect(parseMketyBillingOrderId('MKBILL-6fdd16e0-b8a3-4f8d-9f74-3d9157320189')).toBe(
      '6fdd16e0-b8a3-4f8d-9f74-3d9157320189',
    );
    expect(parseMketyBillingOrderId('MKETY-ENT-123')).toBeNull();
    expect(parseMketyBillingOrderId('MKBILL-not-a-uuid')).toBeNull();
  });

  it('binds a verified finished event to the Mkety billing amount and period', () => {
    const settlement = buildNowPaymentsSettlementForCheckout(
      {
        provider: 'nowpayments',
        rawReference: 'MKBILL-6fdd16e0-b8a3-4f8d-9f74-3d9157320189',
        payload: {
          verified: true,
          eventId: 'pay-123',
          paymentId: 'pay-123',
          paymentStatus: 'finished',
          orderId: 'MKBILL-6fdd16e0-b8a3-4f8d-9f74-3d9157320189',
          providerPayload: {
            price_amount: 16.99,
            price_currency: 'usd',
          },
        },
      },
      {
        subscriptionId: 'subscription-1',
        billingPeriodId: 'period-1',
        amountExpectedMinor: 1699n,
        currency: 'USD',
      },
      new Date('2026-09-18T12:00:00.000Z'),
    );

    expect(settlement).toMatchObject({
      provider: 'nowpayments',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1699n,
      amountPaidMinor: 1699n,
      currencyExpected: 'USD',
      currencyPaid: 'USD',
      status: 'verified_success',
    });
  });

  it('rejects a signed provider event whose amount does not match Mkety Billing', () => {
    expect(() =>
      buildNowPaymentsSettlementForCheckout(
        {
          provider: 'nowpayments',
          payload: {
            verified: true,
            eventId: 'pay-123',
            paymentId: 'pay-123',
            paymentStatus: 'finished',
            providerPayload: {
              price_amount: 1,
              price_currency: 'usd',
            },
          },
        },
        {
          subscriptionId: 'subscription-1',
          billingPeriodId: 'period-1',
          amountExpectedMinor: 1699n,
          currency: 'USD',
        },
      ),
    ).toThrow('amount does not match');
  });
});

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
