import { createMketyPaymentReference } from '@/features/payments/reference';

import { KORA_CAPABILITIES } from './kora-capabilities';
import { toNormalizedSettlement } from './normalization';
import type {
  BillingGatewayAdapter,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedGatewayEvent,
} from './types';
import type { NormalizedSettlement } from '../domain/settlement';

function returnPathFromUrl(value: string): string {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

export function createKoraBillingAdapter(options: {
  publicKey?: string;
  secretKey?: string;
}): BillingGatewayAdapter {
  return {
    provider: 'kora',
    capabilities: KORA_CAPABILITIES,

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      if (!options.publicKey || !options.secretKey) throw new Error('Kora embedded checkout is not configured.');
      if (!input.customer?.email) throw new Error('Kora checkout requires a customer email.');

      const reference = createMketyPaymentReference('saas', input.checkoutId);
      const launcher = new URL('/payments/kora/embedded', input.returnUrl);
      launcher.searchParams.set('checkout', input.checkoutId);
      launcher.searchParams.set('returnPath', returnPathFromUrl(input.returnUrl));

      return {
        provider: 'kora',
        providerCheckoutId: reference,
        checkoutUrl: launcher.toString(),
        providerAmountExpectedMinor: input.amountExpectedMinor,
        providerCurrency: input.currency,
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
