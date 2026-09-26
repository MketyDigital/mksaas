import { buildMketyPaymentMetadata, createMketyPaymentReference } from '@/features/payments/reference';
import { createFlutterwaveInlineSession } from '@/features/payments/server/flutterwave-inline-session';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

export function createFlutterwaveEnterpriseAdapter(options: {
  publicKey?: string;
  secretKey?: string;
  origin?: string;
}): EnterpriseCheckoutProviderAdapter {
  return {
    provider: 'flutterwave',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.publicKey || !options.secretKey) throw new Error('Flutterwave Inline is not configured.');

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const encodedOrderId = encodeURIComponent(input.orderId);
      const metadata = buildMketyPaymentMetadata({
        source: 'enterprise',
        orderId: input.orderId,
      });
      const session = await createFlutterwaveInlineSession({
        source: 'enterprise',
        reference,
        canonicalAmountMinor: input.amountMinor,
        canonicalCurrency: 'USD',
        collectionAmountMinor: input.amountMinor,
        collectionCurrency: input.currency,
        email: input.customer.email,
        customerName: input.customer.fullName,
        redirectUrl: `https://mkety.com/payment/enterprise/success?orderId=${encodedOrderId}`,
        metadata,
        publicKey: options.publicKey,
        secretKey: options.secretKey,
        origin: options.origin,
      });

      return {
        provider: 'flutterwave',
        redirectUrl: session.url,
        providerCheckoutReference: reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
