const mockPaymentSettings = jest.fn();

jest.mock('@/features/payments/settings', () => ({
  getMketyPaymentSettings: mockPaymentSettings,
}));

import { createFlutterwaveBillingAdapter } from './flutterwave';

const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';

describe('Flutterwave billing adapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPaymentSettings.mockResolvedValue({
      baseCurrency: 'USD',
      nowpayments: { checkoutExperience: 'hosted' },
      flutterwave: {
        checkoutExperience: 'inline',
        fxRates: { NGN: '1500' },
        fxMarkupBps: 100,
      },
      kora: { checkoutExperience: 'embedded' },
    });
  });

  it('creates an Mkety Inline launcher and persists the provider quote', async () => {
    const adapter = createFlutterwaveBillingAdapter({
      publicKey: 'FLWPUBK_TEST-public',
      standardSecretKey: 'FLWSECK_TEST-secret',
    });

    const result = await adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1000n,
      currency: 'USD',
      returnUrl: 'https://mkety.com/t/acme/billing/checkout?plan=starter&payment=returned',
      cancelUrl: 'https://mkety.com/t/acme/billing/checkout?plan=starter&payment=cancelled',
      collectionCurrency: 'NGN',
      customer: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });

    expect(result).toMatchObject({
      provider: 'flutterwave',
      providerCheckoutId: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      providerAmountExpectedMinor: 1515000n,
      providerCurrency: 'NGN',
    });
    const launcher = new URL(result.checkoutUrl);
    expect(launcher.origin).toBe('https://mkety.com');
    expect(launcher.pathname).toBe('/payments/flutterwave/inline');
    expect(launcher.searchParams.get('checkout')).toBe(checkoutId);
  });

  it('fails closed when Inline credentials are incomplete', async () => {
    const adapter = createFlutterwaveBillingAdapter({
      publicKey: undefined,
      standardSecretKey: 'secret',
    });
    await expect(adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1000n,
      currency: 'USD',
      returnUrl: 'https://mkety.com/return',
      cancelUrl: 'https://mkety.com/cancel',
      customer: { email: 'ada@example.com' },
    })).rejects.toThrow('Flutterwave Inline is not configured');
  });
});
