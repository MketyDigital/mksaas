import { verifyNowPaymentsWebhook } from '@/features/enterprise-checkout/providers/nowpayments-webhook';

import type { NormalizedSettlement } from '../domain/settlement';
import { NOWPAYMENTS_CAPABILITIES } from './nowpayments-capabilities';
import { parseVerifiedSettlementFields, toNormalizedSettlement } from './normalization';
import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from './types';

const NOWPAYMENTS_INVOICE_ENDPOINT = 'https://api.nowpayments.io/v1/invoice';
const MKETY_BILLING_WEBHOOK_URL = 'https://mkety.com/api/webhooks/billing/nowpayments';

function minorUnitsToUsd(amountMinor: bigint): number {
  if (amountMinor <= 0n) throw new Error('Checkout amount must be greater than zero.');
  return Number(amountMinor) / 100;
}

export interface CreateNowPaymentsBillingAdapterOptions {
  apiKey?: string;
  ipnSecret?: string;
  fetchImpl?: typeof fetch;
  webhookUrl?: string;
}

export function createNowPaymentsBillingAdapter(
  options: CreateNowPaymentsBillingAdapterOptions,
): BillingGatewayAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    provider: 'nowpayments',
    capabilities: NOWPAYMENTS_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.apiKey) throw new Error('NOWPayments is not configured.');
      if (input.currency !== 'USD') throw new Error('NOWPayments self-service checkout currently requires USD.');

      const response = await fetchImpl(NOWPAYMENTS_INVOICE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
        },
        body: JSON.stringify({
          price_amount: minorUnitsToUsd(input.amountExpectedMinor),
          price_currency: 'usd',
          order_id: `MKBILL-${input.checkoutId}`,
          order_description: 'Mkety self-service subscription',
          ipn_callback_url: options.webhookUrl ?? MKETY_BILLING_WEBHOOK_URL,
          success_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        }),
      });

      if (!response.ok) throw new Error('NOWPayments invoice creation failed.');
      const payload = (await response.json()) as { id?: string | number; invoice_url?: string };
      if (!payload.invoice_url || !payload.invoice_url.startsWith('https://')) {
        throw new Error('NOWPayments returned an invalid invoice URL.');
      }

      return {
        provider: 'nowpayments',
        providerCheckoutId: payload.id == null ? undefined : String(payload.id),
        checkoutUrl: payload.invoice_url,
      };
    },

    async verifyIncomingEvent(request: Request): Promise<VerifiedGatewayEvent> {
      if (!options.ipnSecret) throw new Error('NOWPayments webhook secret is not configured.');
      const rawBody = await request.text();
      const verified = await verifyNowPaymentsWebhook(
        rawBody,
        request.headers.get('x-nowpayments-sig'),
        options.ipnSecret,
      );

      return {
        provider: 'nowpayments',
        rawReference: verified.orderId,
        payload: {
          verified: true,
          eventId: verified.paymentId ?? `${verified.orderId}:${verified.paymentStatus}`,
          paymentId: verified.paymentId ?? verified.orderId,
          paymentStatus: verified.paymentStatus,
          orderId: verified.orderId,
          providerPayload: verified.raw,
        },
      };
    },

    normalizeSettlement: normalizeNowPaymentsSettlement,
  };
}

export function normalizeNowPaymentsSettlement(event: VerifiedGatewayEvent): NormalizedSettlement {
  if (event.provider !== 'nowpayments') {
    throw new Error('NOWPayments adapter received a different provider event.');
  }

  const { payload, fields } = parseVerifiedSettlementFields(event);
  if (payload.paymentStatus !== 'finished') {
    throw new Error('NOWPayments settlement requires final finished payment status.');
  }

  return toNormalizedSettlement('nowpayments', event, fields);
}

export const nowPaymentsGatewayAdapter = createNowPaymentsBillingAdapter({
  apiKey: process.env.NOWPAYMENTS_API_KEY,
  ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
});
