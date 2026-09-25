import type { NormalizedSettlement } from '../domain/settlement';
import { createMketyPaymentReference, buildMketyPaymentMetadata } from '@/features/payments/reference';

import { KORA_CAPABILITIES } from './kora-capabilities';
import { toNormalizedSettlement } from './normalization';
import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from './types';

const KORA_INITIALIZE_URL = 'https://api.korapay.com/merchant/api/v1/charges/initialize';
const KORA_WEBHOOK_URL = 'https://mkety.com/api/payments/kora/webhook';

function minorUnitsToDecimal(amountMinor: bigint): number {
  if (amountMinor <= 0n) throw new Error('Checkout amount must be greater than zero.');
  return Number(amountMinor) / 100;
}

export function createKoraBillingAdapter(options: {
  secretKey?: string;
  fetchImpl?: typeof fetch;
  webhookUrl?: string;
}): BillingGatewayAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    provider: 'kora',
    capabilities: KORA_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.secretKey) throw new Error('Kora is not configured.');
      if (!input.customer?.email) throw new Error('Kora checkout requires a customer email.');

      const reference = createMketyPaymentReference('saas', input.checkoutId);
      const response = await fetchImpl(KORA_INITIALIZE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: minorUnitsToDecimal(input.amountExpectedMinor),
          currency: input.currency,
          reference,
          redirect_url: input.returnUrl,
          notification_url: options.webhookUrl ?? KORA_WEBHOOK_URL,
          customer: {
            email: input.customer.email,
            ...(input.customer.name ? { name: input.customer.name } : {}),
          },
          metadata: buildMketyPaymentMetadata({
            source: 'saas',
            checkoutId: input.checkoutId,
            tenantId: input.tenantId,
          }),
          merchant_bears_cost: true,
          narration: 'Mkety subscription checkout',
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        data?: { reference?: string; checkout_url?: string };
      } | null;
      const checkoutUrl = payload?.data?.checkout_url;
      if (!response.ok || payload?.status !== true || !checkoutUrl || !checkoutUrl.startsWith('https://')) {
        throw new Error('Kora checkout creation failed.');
      }

      return {
        provider: 'kora',
        providerCheckoutId: payload?.data?.reference ?? reference,
        checkoutUrl,
      };
    },

    async verifyIncomingEvent(): Promise<VerifiedGatewayEvent> {
      throw new Error('Kora webhook verification is handled by the shared Mkety payments endpoint.');
    },

    normalizeSettlement(event: VerifiedGatewayEvent): NormalizedSettlement {
      if (event.provider !== 'kora') throw new Error('Kora adapter received a different provider event.');
      const payload = event.payload as Record<string, unknown>;
      if (payload.status !== 'success') throw new Error('Kora settlement must have successful payment status.');
      return toNormalizedSettlement('kora', event, {
        eventId: String(payload.eventId ?? ''),
        paymentId: String(payload.paymentId ?? ''),
        subscriptionId: String(payload.subscriptionId ?? ''),
        billingPeriodId: String(payload.billingPeriodId ?? ''),
        amountExpectedMinor: BigInt(String(payload.amountExpectedMinor ?? '0')),
        currencyExpected: String(payload.currencyExpected ?? ''),
        amountPaidMinor: BigInt(String(payload.amountPaidMinor ?? '0')),
        currencyPaid: String(payload.currencyPaid ?? ''),
        occurredAt: new Date(String(payload.occurredAt ?? new Date().toISOString())),
      });
    },
  };
}
