import { createKoraBillingAdapter } from './kora';

const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';

describe('Kora billing adapter', () => {
  it('creates a hosted checkout with Mkety-owned routing reference and metadata', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
          checkout_url: 'https://checkout.korapay.com/test',
        },
      }),
    });
    const adapter = createKoraBillingAdapter({ secretKey: 'secret', fetchImpl: fetchMock });

    const result = await adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 4842n,
      currency: 'USD',
      returnUrl: 'https://mkety.com/t/acme/billing/checkout?payment=returned',
      cancelUrl: 'https://mkety.com/t/acme/billing/checkout?payment=cancelled',
      customer: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      notification_url: 'https://mkety.com/api/payments/kora/webhook',
      metadata: {
        source: 'saas',
        checkout_id: checkoutId,
        tenant_id: 'tenant-1',
      },
      customer: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });
    expect(result.provider).toBe('kora');
    expect(result.checkoutUrl).toBe('https://checkout.korapay.com/test');
  });

  it('fails closed when the secret is absent', async () => {
    const adapter = createKoraBillingAdapter({ secretKey: undefined, fetchImpl: jest.fn() });
    await expect(adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 4842n,
      currency: 'USD',
      returnUrl: 'https://mkety.com/return',
      cancelUrl: 'https://mkety.com/cancel',
      customer: { email: 'ada@example.com' },
    })).rejects.toThrow('Kora is not configured');
  });
});
