import {
  createSaasFlutterwaveMetadata,
  createSaasFlutterwaveReference,
  isMketyFlutterwaveCollectionCurrency,
  quoteFlutterwaveCollection,
} from '@/features/payments/flutterwave-standard';
import { getMketyPaymentSettings } from '@/features/payments/settings';

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

function returnPathFromUrl(value: string): string {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

export function createFlutterwaveBillingAdapter(options: {
  publicKey?: string;
  standardSecretKey?: string;
}): BillingGatewayAdapter {
  return {
    provider: 'flutterwave',
    capabilities: FLUTTERWAVE_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.publicKey || !options.standardSecretKey) {
        throw new Error('Flutterwave Inline is not configured.');
      }
      if (!input.customer?.email) throw new Error('Flutterwave checkout requires a customer email.');
      if (input.currency !== 'USD') throw new Error('Mkety canonical Flutterwave billing currently requires USD pricing.');

      const collectionCurrency = String(input.collectionCurrency ?? 'USD').toUpperCase();
      if (!isMketyFlutterwaveCollectionCurrency(collectionCurrency)) {
        throw new Error('Selected Flutterwave collection currency is not supported.');
      }

      const settings = await getMketyPaymentSettings();
      const quote = await quoteFlutterwaveCollection({
        canonicalAmountMinor: input.amountExpectedMinor,
        canonicalCurrency: 'USD',
        collectionCurrency,
        configuredRates: settings.flutterwave.fxRates,
        markupBps: settings.flutterwave.fxMarkupBps,
      });
      const reference = createSaasFlutterwaveReference(input.checkoutId);
      const launcher = new URL('/payments/flutterwave/inline', input.returnUrl);
      launcher.searchParams.set('checkout', input.checkoutId);
      launcher.searchParams.set('returnPath', returnPathFromUrl(input.returnUrl));

      return {
        provider: 'flutterwave',
        providerCheckoutId: reference,
        checkoutUrl: launcher.toString(),
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

export { createSaasFlutterwaveMetadata };
