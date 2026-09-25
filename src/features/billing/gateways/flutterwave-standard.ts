import type { NormalizedSettlement } from '@/features/billing/domain/settlement';
import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from '@/features/billing/gateways/types';
import type { FlutterwaveSettlementCurrency } from '@/features/payments/flutterwave-currency';
import { quoteFlutterwaveSettlement } from '@/features/payments/flutterwave-currency';
import { createFlutterwaveStandardHostedCheckout } from '@/features/payments/flutterwave-standard';
import { buildMketyPaymentMetadata, createMketyPaymentReference } from '@/features/payments/reference';

export function createFlutterwaveStandardBillingAdapter(options: {
  secretKey?: string;
  settlementCurrency: FlutterwaveSettlementCurrency;
  serializedRates?: string;
  fetchImpl?: typeof fetch;
}): BillingGatewayAdapter {
  return {
    provider: 'flutterwave',
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

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.secretKey) throw new Error('Flutterwave hosted checkout is not configured.');
      if (!input.customer?.email) throw new Error('Flutterwave checkout requires a customer email.');
      if (input.currency !== 'USD') throw new Error('Mkety canonical Flutterwave pricing must remain USD.');

      const quote = quoteFlutterwaveSettlement({
        canonicalUsdMinor: input.amountExpectedMinor,
        currency: options.settlementCurrency,
        serializedRates: options.serializedRates,
      });
      const reference = createMketyPaymentReference('saas', input.checkoutId);
      const { checkoutUrl } = await createFlutterwaveStandardHostedCheckout({
        secretKey: options.secretKey,
        reference,
        amountMinor: quote.settlementAmountMinor,
        currency: quote.settlementCurrency,
        redirectUrl: input.returnUrl,
        customer: input.customer,
        metadata: buildMketyPaymentMetadata({
          source: 'saas',
          checkoutId: input.checkoutId,
          tenantId: input.tenantId,
        }),
        title: 'Mkety',
        description: 'Mkety subscription checkout',
        fetchImpl: options.fetchImpl,
      });

      return {
        provider: 'flutterwave',
        providerCheckoutId: reference,
        checkoutUrl,
        settlementAmountExpectedMinor: quote.settlementAmountMinor,
        settlementCurrency: quote.settlementCurrency,
      };
    },

    async verifyIncomingEvent(): Promise<VerifiedGatewayEvent> {
      throw new Error('Flutterwave webhook verification is handled by the shared Mkety payments endpoint.');
    },

    normalizeSettlement(): NormalizedSettlement {
      throw new Error('Flutterwave settlement normalization is handled by the shared Mkety payments endpoint.');
    },
  };
}
