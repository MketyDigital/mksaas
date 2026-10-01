import { createCentralFlutterwaveCheckout } from '@/features/payments/central-flutterwave-broker';
import { createSaasFlutterwaveReference } from '@/features/payments/flutterwave-standard';

import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from './types';
import type { NormalizedSettlement } from '../domain/settlement';
import type { GatewayCapabilities } from '../domain/types';

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
  brokerSecret?: string;
  brokerUrl?: string;
  fetchImpl?: typeof fetch;
}): BillingGatewayAdapter {
  return {
    provider: 'flutterwave',
    capabilities: FLUTTERWAVE_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.brokerSecret) throw new Error('Mkety Flutterwave payment broker is not configured.');
      if (!input.customer?.email) throw new Error('Flutterwave checkout requires a customer email.');
      if (input.currency !== 'USD') throw new Error('Mkety canonical Flutterwave billing currently requires USD pricing.');

      const reference = createSaasFlutterwaveReference(input.checkoutId);
      const broker = await createCentralFlutterwaveCheckout(
        {
          source: 'saas',
          reference,
          canonicalAmountMinor: input.amountExpectedMinor,
          requestedPaymentCurrency: input.collectionCurrency ?? 'USD',
          email: input.customer.email,
          customerName: input.customer.name,
          tenantId: input.tenantId,
          checkoutId: input.checkoutId,
          redirectUrl: input.returnUrl,
        },
        {
          brokerSecret: options.brokerSecret,
          brokerUrl: options.brokerUrl,
          fetchImpl: options.fetchImpl,
          experience: 'inline',
        },
      );

      const returnUrl = new URL(input.returnUrl);
      const returnPath = `${returnUrl.pathname}${returnUrl.search}`;
      const launcher = new URL('/payments/flutterwave/inline', input.returnUrl);
      launcher.searchParams.set('checkout', input.checkoutId);
      launcher.searchParams.set('returnPath', returnPath);

      return {
        provider: 'flutterwave',
        providerCheckoutId: reference,
        checkoutUrl: broker.experience === 'hosted' && broker.checkoutUrl
          ? broker.checkoutUrl
          : launcher.toString(),
        providerAmountExpectedMinor: broker.providerAmountMinor,
        providerCurrency: broker.providerCurrency,
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

