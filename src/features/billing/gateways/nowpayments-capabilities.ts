import type { GatewayCapabilities } from '../domain/types';

/**
 * Conservative default capability profile for NOWPayments.
 * Recurring invoices are supported, but automatic balance/custody deductions
 * require explicit merchant/customer configuration and are not assumed for a
 * normal crypto checkout.
 */
export const NOWPAYMENTS_CAPABILITIES: GatewayCapabilities = {
  supportsRecurring: true,
  supportsAutoCharge: false,
  supportsHostedSubscription: false,
  supportsRecurringInvoice: true,
  supportsWebhookVerification: true,
  supportsRefunds: true,
  supportsPartialPayment: true,
  supportsMultipleCurrencies: true,
};
