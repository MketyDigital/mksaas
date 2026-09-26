import { createFlutterwaveHostedCheckout } from '@/features/payments/flutterwave-standard';
import { buildMketyPaymentMetadata, createMketyPaymentReference } from '@/features/payments/reference';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

export function createFlutterwaveEnterpriseAdapter(options: {
  standardSecretKey?: string;
  fetchImpl?: typeof fetch;
}): EnterpriseCheckoutProviderAdapter {
  return {
    provider: 'flutterwave',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.standardSecretKey) throw new Error('Flutterwave hosted checkout is not configured.');

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const encodedOrderId = encodeURIComponent(input.orderId);
      const redirectUrl = await createFlutterwaveHostedCheckout({
        source: 'enterprise',
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        email: input.customer.email,
        customerName: input.customer.fullName,
        redirectUrl: `https://mkety.com/payment/enterprise/success?orderId=${encodedOrderId}`,
        metadata: buildMketyPaymentMetadata({
          source: 'enterprise',
          orderId: input.orderId,
        }),
        secretKey: options.standardSecretKey,
        fetchImpl: options.fetchImpl,
      });

      return {
        provider: 'flutterwave',
        redirectUrl,
        providerCheckoutReference: reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
