import type { BillingGatewayAdapter } from '../gateways/types';
import { NOWPAYMENTS_CAPABILITIES } from '../gateways/nowpayments-capabilities';
import { createSelfServiceCheckout, type SelfServiceCheckoutRepository } from './self-service-checkout';

function repository(): SelfServiceCheckoutRepository & {
  ready: jest.Mock;
  failed: jest.Mock;
} {
  const ready = jest.fn();
  const failed = jest.fn();
  return {
    ready,
    failed,
    async prepareCheckout() {
      return {
        checkoutId: 'checkout-1',
        tenantId: 'tenant-1',
        subscriptionId: 'subscription-1',
        billingPeriodId: 'period-1',
        amountExpectedMinor: 1699n,
        currency: 'USD',
      };
    },
    markCheckoutReady: ready,
    markCheckoutFailed: failed,
  };
}

function adapter(overrides: Partial<BillingGatewayAdapter> = {}): BillingGatewayAdapter {
  return {
    provider: 'nowpayments',
    capabilities: NOWPAYMENTS_CAPABILITIES,
    async createCheckout() {
      return {
        provider: 'nowpayments',
        providerCheckoutId: 'provider-1',
        checkoutUrl: 'https://pay.example/checkout',
      };
    },
    async verifyIncomingEvent() {
      throw new Error('unused');
    },
    normalizeSettlement() {
      throw new Error('unused');
    },
    ...overrides,
  };
}

describe('createSelfServiceCheckout', () => {
  it('uses the server-owned billing amount and persists the provider redirect', async () => {
    const repo = repository();
    const gateway = adapter();

    const result = await createSelfServiceCheckout(repo, gateway, {
      tenantId: 'tenant-1',
      planKey: 'ai-workspace',
      returnUrl: 'https://mkety.com/payment/success',
      cancelUrl: 'https://mkety.com/payment/cancelled',
      now: new Date('2026-09-18T12:00:00.000Z'),
    });

    expect(result.checkoutUrl).toBe('https://pay.example/checkout');
    expect(repo.ready).toHaveBeenCalledWith(expect.objectContaining({
      checkoutId: 'checkout-1',
      providerCheckoutId: 'provider-1',
    }));
    expect(repo.failed).not.toHaveBeenCalled();
  });

  it('fails before payment when the prepared amount does not match the canonical plan', async () => {
    const repo = repository();
    repo.prepareCheckout = jest.fn().mockResolvedValue({
      checkoutId: 'checkout-1',
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      amountExpectedMinor: 1n,
      currency: 'USD',
    });

    await expect(createSelfServiceCheckout(repo, adapter(), {
      tenantId: 'tenant-1',
      planKey: 'ai-workspace',
      returnUrl: 'https://mkety.com/payment/success',
      cancelUrl: 'https://mkety.com/payment/cancelled',
    })).rejects.toThrow('authoritative Mkety billing catalog');
  });

  it('cancels the pending checkout state when provider invoice creation fails', async () => {
    const repo = repository();
    const gateway = adapter({
      async createCheckout() {
        throw new Error('provider unavailable');
      },
    });

    await expect(createSelfServiceCheckout(repo, gateway, {
      tenantId: 'tenant-1',
      planKey: 'ai-workspace',
      returnUrl: 'https://mkety.com/payment/success',
      cancelUrl: 'https://mkety.com/payment/cancelled',
    })).rejects.toThrow('provider unavailable');

    expect(repo.failed).toHaveBeenCalledWith(expect.objectContaining({
      checkoutId: 'checkout-1',
      subscriptionId: 'subscription-1',
    }));
  });
});
