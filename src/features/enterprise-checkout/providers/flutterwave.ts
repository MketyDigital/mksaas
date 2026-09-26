import { createMketyPaymentReference } from '@/features/payments/reference';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

export function createFlutterwaveEnterpriseAdapter(options: {
  publicKey?: string;
  standardSecretKey?: string;
}): EnterpriseCheckoutProviderAdapter {
  return {
    provider: 'flutterwave',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.publicKey || !options.standardSecretKey) {
        throw new Error('Flutterwave Inline is not configured.');
      }

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const encodedOrderId = encodeURIComponent(input.orderId);

      return {
        provider: 'flutterwave',
        redirectUrl: `https://mkety.com/payment/enterprise/flutterwave?orderId=${encodedOrderId}`,
        providerCheckoutReference: reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
