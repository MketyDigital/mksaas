import {
  createSaasFlutterwaveMetadata,
  createSaasFlutterwaveReference,
  isMketyFlutterwaveCollectionCurrency,
} from '@/features/payments/flutterwave-standard';
import { createFlutterwaveInlineSession } from '@/features/payments/server/flutterwave-inline-session';
import { getMketyPaymentSettings, quoteMketyFlutterwaveCurrency } from '@/features/payments/settings';

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
  publicKey?: string;
  secretKey?: string;
  origin?: string;
}): BillingGatewayAdapter {
  return {
    provider: 'flutterwave',
    capabilities: FLUTTERWAVE_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.publicKey || !options.secretKey) throw new Error('Flutterwave Inline is not configured.');
      if (!input.customer?.email) throw new Error('Flutterwave checkout requires a customer email.');
      if (input.currency !== 'USD') throw new Error('Mkety canonical Flutterwave billing currently requires USD pricing.');

      const collectionCurrency = String(input.collectionCurrency ?? 'USD').toUpperCase();
      if (!isMketyFlutterwaveCollectionCurrency(collectionCurrency)) {
        throw new Error('Selected Flutterwave collection currency is not supported.');
      }

      const settings = await getMketyPaymentSettings();
      const quote = quoteMketyFlutterwaveCurrency({
        canonicalAmountMinor: input.amountExpectedMinor,
        collectionCurrency,
        settings,
      });
      const reference = createSaasFlutterwaveReference(input.checkoutId);
      const metadata = {
        ...createSaasFlutterwaveMetadata(input.checkoutId, input.tenantId),
        canonical_amount_minor: input.amountExpectedMinor.toString(),
        canonical_currency: input.currency,
        provider_amount_minor: quote.amountMinor.toString(),
        provider_currency: quote.currency,
        fx_rate: quote.baseRate,
        fx_markup_bps: quote.markupBps,
        fx_source: quote.source,
      };
      const session = await createFlutterwaveInlineSession({
        source: 'saas',
        reference,
        canonicalAmountMinor: input.amountExpectedMinor,
        canonicalCurrency: 'USD',
        collectionAmountMinor: quote.amountMinor,
        collectionCurrency: quote.currency,
        email: input.customer.email,
        customerName: input.customer.name,
        redirectUrl: input.returnUrl,
        metadata,
        publicKey: options.publicKey,
        secretKey: options.secretKey,
        origin: options.origin,
      });

      return {
        provider: 'flutterwave',
        providerCheckoutId: reference,
        checkoutUrl: session.url,
        providerAmountExpectedMinor: quote.amountMinor,
        providerCurrency: quote.currency,
        expiresAt: session.expiresAt,
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
