import { resolveRenewalMode } from './renewal-policy';

const baseCapabilities = {
  supportsRecurring: false,
  supportsAutoCharge: false,
  supportsHostedSubscription: false,
  supportsRecurringInvoice: false,
  supportsWebhookVerification: true,
  supportsRefunds: false,
  supportsPartialPayment: false,
  supportsMultipleCurrencies: true,
} as const;

describe('resolveRenewalMode', () => {
  it('uses manual renewal when auto-renew is disabled', () => {
    expect(
      resolveRenewalMode(
        { autoRenew: false },
        { ...baseCapabilities, supportsRecurring: true, supportsAutoCharge: true },
      ),
    ).toBe('manual');
  });

  it('uses automatic renewal when verified auto-charge is supported', () => {
    expect(
      resolveRenewalMode(
        { autoRenew: true },
        { ...baseCapabilities, supportsRecurring: true, supportsAutoCharge: true },
      ),
    ).toBe('automatic');
  });

  it('uses provider-managed renewal for hosted recurring subscriptions without auto-charge control', () => {
    expect(
      resolveRenewalMode(
        { autoRenew: true },
        { ...baseCapabilities, supportsRecurring: true, supportsHostedSubscription: true },
      ),
    ).toBe('provider_managed');
  });

  it('uses invoice-required renewal when recurring invoices are supported', () => {
    expect(
      resolveRenewalMode(
        { autoRenew: true },
        { ...baseCapabilities, supportsRecurring: true, supportsRecurringInvoice: true },
      ),
    ).toBe('invoice_required');
  });

  it('falls back to manual renewal when reliable recurring collection is unsupported', () => {
    expect(resolveRenewalMode({ autoRenew: true }, baseCapabilities)).toBe('manual');
  });
});