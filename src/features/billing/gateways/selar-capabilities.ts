import type { GatewayCapabilities } from '../domain/types';

/**
 * Provider-level capability ceiling for Selar.
 * Runtime adapters must downgrade capabilities when the configured merchant
 * account or selected payment method cannot prove/support a capability.
 */
export const SELAR_CAPABILITIES: GatewayCapabilities = {
  supportsRecurring: true,
  supportsAutoCharge: true,
  supportsHostedSubscription: true,
  supportsRecurringInvoice: true,
  supportsWebhookVerification: true,
  supportsRefunds: true,
  supportsPartialPayment: false,
  supportsMultipleCurrencies: true,
};
