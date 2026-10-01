import { createFlutterwaveBillingAdapter } from './flutterwave';

const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';

describe('Flutterwave billing adapter', () => {
  it('uses the central Mkety broker contract used by Media', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        checkout_experience: 'inline',
        inline: {
          publicKey: 'FLWPUBK_TEST-public',
          reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
          amount: 15150,
          currency: 'NGN',
          email: 'ada@example.com',
          redirectPath: '/app/acme/enterprise-ai?payment=returned',
          metadata: { source: 'saas', checkout_id: checkoutId, tenant_id: 'tenant-1' },
          payloadHash: 'signed-payload-hash',
        },
        provider_amount_minor: '1515000',
        provider_currency: 'NGN',
      }),
    });
    const adapter = createFlutterwaveBillingAdapter({
      brokerSecret: 'b'.repeat(40),
      fetchImpl: fetchMock,
    });

    const result = await adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1000n,
      currency: 'USD',
      returnUrl: 'https://app.mkety.com/app/acme/enterprise-ai?payment=returned',
      cancelUrl: 'https://app.mkety.com/app/acme/enterprise-ai?payment=cancelled',
      collectionCurrency: 'NGN',
      customer: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });

    expect(result).toEqual({
      provider: 'flutterwave',
      providerCheckoutId: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      checkoutUrl: `https://app.mkety.com/payments/flutterwave/inline?checkout=${checkoutId}&returnPath=%2Fapp%2Facme%2Fenterprise-ai%3Fpayment%3Dreturned`,
      providerAmountExpectedMinor: 1515000n,
      providerCurrency: 'NGN',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mkety.com/api/payments/flutterwave/start',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${'b'.repeat(40)}` }),
      }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request).toMatchObject({
      source: 'saas',
      reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      canonical_amount_usd: '10.00',
      requested_payment_currency: 'NGN',
      checkout_id: checkoutId,
      tenant_id: 'tenant-1',
      checkout_experience: 'inline',
    });
  });

  it('fails closed when the central broker secret is missing', async () => {
    const adapter = createFlutterwaveBillingAdapter({ brokerSecret: undefined });
    await expect(adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1000n,
      currency: 'USD',
      returnUrl: 'https://app.mkety.com/app/acme/enterprise-ai?payment=returned',
      cancelUrl: 'https://app.mkety.com/app/acme/enterprise-ai?payment=cancelled',
      customer: { email: 'ada@example.com' },
    })).rejects.toThrow('Mkety Flutterwave payment broker is not configured');
  });
});
