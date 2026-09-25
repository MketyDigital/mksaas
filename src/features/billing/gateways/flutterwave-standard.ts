import { buildMketyPaymentMetadata, createMketyPaymentReference } from '@/features/payments/reference';

import type { BillingGatewayAdapter, CreateCheckoutInput, CreateCheckoutResult, VerifiedGatewayEvent } from '@/features/billing/gateways/types';
import type { NormalizedSettlement } from '@/features/billing/domain/settlement';
import type { FlutterwaveSettlementCurrency } from '@/features/payments/flutterwave-currency';
import { quoteFlutterwaveSettlement } from '@/features/payments/flutterwave-currency';

const STANDARD_URL = 'https://api.flutterwave.com/v3/payments';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildPayloadHash(input: {
  amount: string;
  currency: string;
  email: string;
  reference: string;
  secretKey: string;
}): Promise<string> {
  const secretHash = await sha256Hex(input.secretKey);
  return sha256Hex(`${input.amount}${input.currency}${input.email}${input.reference}${secretHash}`);
}

function minorToDecimal(amountMinor: bigint): string {
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, '0');
  return `${major}.${minor}`;
}

export function createFlutterwaveStandardBillingAdapter(options: {
  secretKey?: string;
  settlementCurrency: FlutterwaveSettlementCurrency;
  serializedRates?: string;
  fetchImpl?: typeof fetch;
}): BillingGatewayAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

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
      const amount = minorToDecimal(quote.settlementAmountMinor);
      const payloadHash = await buildPayloadHash({
        amount,
        currency: quote.settlementCurrency,
        email: input.customer.email,
        reference,
        secretKey: options.secretKey,
      });

      const response = await fetchImpl(STANDARD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount,
          currency: quote.settlementCurrency,
          redirect_url: input.returnUrl,
          customer: {
            email: input.customer.email,
            ...(input.customer.name ? { name: input.customer.name } : {}),
          },
          meta: buildMketyPaymentMetadata({
            source: 'saas',
            checkoutId: input.checkoutId,
            tenantId: input.tenantId,
          }),
          customizations: {
            title: 'Mkety',
            description: 'Mkety subscription checkout',
            logo: 'https://mkety.com/icon.png',
          },
          payload_hash: payloadHash,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        data?: { link?: string };
      } | null;
      const checkoutUrl = payload?.data?.link;
      if (!response.ok || payload?.status !== 'success' || !checkoutUrl?.startsWith('https://')) {
        throw new Error('Flutterwave hosted checkout creation failed.');
      }

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
