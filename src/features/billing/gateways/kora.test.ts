import { createKoraBillingAdapter } from './kora';

const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';

describe('Kora billing adapter', () => {
  it('creates an Mkety embedded-checkout launcher with an Mkety-owned routing reference', async () => {
    const adapter = createKoraBillingAdapter({ publicKey: 'pk_test_example', secretKey: 'secret' });

    const result = await adapter.createCheckout({
      checkoutId,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 4842n,
      currency: 'USD',
      returnUrl: 'https://mkety.com/t/acme/billing/checkout?plan=starter&payment=returned',
      cancelUrl: 'https://mkety.com/t/acme/billing/checkout?plan=starter&payment=cancelled',
      customer: { email: 'ada@example.com', name: 'Ada Lovelace' },
    });

    expect(result).toMatchObject({
      provider: 'kora',
      providerCheckoutId: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      providerAmountExpectedMinor: 4842n,
      providerCurrency: 'USD',
    });
    const launcher = new URL(result.checkoutUrl);
    expect(launcher.origin).toBe('https://mkety.com');
    expect(launcher.pathname).toBe('/payments/kora/embedded');
    expect(launcher.searchParams.get('checkout')).toBe(checkoutId);
    expect(launcher.searchParams.get('returnPath')).toContain('/t/acme/billing/checkout');
  });

  it('fails closed when either Kora key is absent', async () => {
    const adapter = createKoraBillingAdapter({ publicKey: undefined, secretKey: 'secret' });
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
    })).rejects.toThrow('Kora embedded checkout is not configured');
  });
});
