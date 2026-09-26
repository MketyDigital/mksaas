import {
  createFlutterwaveHostedCheckout,
  createSaasFlutterwaveMetadata,
  createSaasFlutterwaveReference,
  isMketyFlutterwaveCollectionCurrency,
  quoteFlutterwaveCollection,
} from '@/features/payments/flutterwave-standard';

import type { NormalizedSettlement } from '../domain/settlement';
import type { GatewayCapabilities } from '../domain/types';
import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from './types';

const FLUTTERWAVE_CAPABILITIES: GatewayCapabilities = {
  supportsRecurring: false,
  supportsAutoCharge: false,
  supportsHostedSubscription: false,
  supportsRecurringInvoice: false,
  supportsWebhookVerification: true,
  supportsRefunds: true,
  supportsPartialPayment: false,
  supportsMultipleCurrencies: true,
};

export function createFlutterwaveBillingAdapter(options: {
  standardSecretKey?: string;
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}): BillingGatewayAdapter {
  return {
    provider: 'flutterwave',
    capabilities: FLUTTERWAVE_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.standardSecretKey) throw new Error('Flutterwave hosted checkout is not configured.');
      if (!input.customer?.email) throw new Error('Flutterwave checkout requires a customer email.');
      if (input.currency !== 'USD') throw new Error('Mkety canonical Flutterwave billing currently requires USD pricing.');

      const collectionCurrency = String(input.collectionCurrency ?? 'USD').toUpperCase();
      if (!isMketyFlutterwaveCollectionCurrency(collectionCurrency)) {
        throw new Error('Selected Flutterwave collection currency is not supported.');
      }

      const quote = await quoteFlutterwaveCollection({
        canonicalAmountMinor: input.amountExpectedMinor,
        canonicalCurrency: 'USD',
        collectionCurrency,
        configuredRatesJson: process.env.MKETY_PAYMENT_FX_RATES_JSON,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        fetchImpl: options.fetchImpl,
      });
      const reference = createSaasFlutterwaveReference(input.checkoutId);
      const checkoutUrl = await createFlutterwaveHostedCheckout({
        source: 'saas',
        reference,
        amountMinor: quote.amountMinor,
        currency: quote.currency,
        email: input.customer.email,
        customerName: input.customer.name,
        redirectUrl: input.returnUrl,
        metadata: {
          ...createSaasFlutterwaveMetadata(input.checkoutId, input.tenantId),
          canonical_amount_minor: input.amountExpectedMinor.toString(),
          canonical_currency: input.currency,
          provider_amount_minor: quote.amountMinor.toString(),
          provider_currency: quote.currency,
          ...(quote.rate ? { fx_rate: quote.rate } : {}),
          fx_source: quote.source,
        },
        secretKey: options.standardSecretKey,
        fetchImpl: options.fetchImpl,
      });

      return {
        provider: 'flutterwave',
        providerCheckoutId: reference,
        checkoutUrl,
        providerAmountExpectedMinor: quote.amountMinor,
        providerCurrency: quote.currency,
      };
    },

    async verifyIncomingEvent(): Promise<VerifiedGatewayEvent> {
      throw new Error('Flutterwave webhook verification is handled by the shared Mkety payments endpoint.');
    },

    normalizeSettlement(): NormalizedSettlement {
      throw new Error('Flutterwave settlement normalization is handled by the shared Mkety payments router.');
    },
  };
}
