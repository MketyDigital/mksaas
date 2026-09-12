import { NOWPAYMENTS_CAPABILITIES } from './nowpayments-capabilities';
import { BillingGatewayRegistry } from './registry';
import { SELAR_CAPABILITIES } from './selar-capabilities';
import type { BillingGatewayAdapter } from './types';

function makeAdapter(provider: string): BillingGatewayAdapter {
  return {
    provider,
    capabilities: {
      supportsRecurring: false,
      supportsAutoCharge: false,
      supportsHostedSubscription: false,
      supportsRecurringInvoice: false,
      supportsWebhookVerification: true,
      supportsRefunds: false,
      supportsPartialPayment: false,
      supportsMultipleCurrencies: true,
    },
    async createCheckout() {
      return { provider, checkoutUrl: 'https://checkout.example' };
    },
    async verifyIncomingEvent() {
      return { provider, payload: {} };
    },
    normalizeSettlement() {
      throw new Error('not used in registry tests');
    },
  };
}

describe('BillingGatewayRegistry', () => {
  it('returns the exact registered provider adapter', () => {
    const registry = new BillingGatewayRegistry();
    const adapter = makeAdapter('selar');

    registry.register(adapter);

    expect(registry.get('selar')).toBe(adapter);
  });

  it('fails closed for an unknown provider', () => {
    const registry = new BillingGatewayRegistry();

    expect(() => registry.get('unknown')).toThrow('Unknown billing gateway provider: unknown');
  });

  it('rejects duplicate provider registration', () => {
    const registry = new BillingGatewayRegistry();
    registry.register(makeAdapter('nowpayments'));

    expect(() => registry.register(makeAdapter('nowpayments'))).toThrow(
      'Billing gateway provider already registered: nowpayments',
    );
  });
});

describe('initial gateway capability profiles', () => {
  it('models Selar as recurring-capable with verified-webhook support', () => {
    expect(SELAR_CAPABILITIES.supportsRecurring).toBe(true);
    expect(SELAR_CAPABILITIES.supportsAutoCharge).toBe(true);
    expect(SELAR_CAPABILITIES.supportsHostedSubscription).toBe(true);
    expect(SELAR_CAPABILITIES.supportsWebhookVerification).toBe(true);
  });

  it('does not claim every NOWPayments checkout is automatically chargeable', () => {
    expect(NOWPAYMENTS_CAPABILITIES.supportsRecurring).toBe(true);
    expect(NOWPAYMENTS_CAPABILITIES.supportsRecurringInvoice).toBe(true);
    expect(NOWPAYMENTS_CAPABILITIES.supportsAutoCharge).toBe(false);
    expect(NOWPAYMENTS_CAPABILITIES.supportsWebhookVerification).toBe(true);
  });
});
