import { createMketyPaymentReference } from '@/features/payments/reference';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

export function createKoraEnterpriseAdapter(options: {
  publicKey?: string;
  secretKey?: string;
}): EnterpriseCheckoutProviderAdapter {
  return {
    provider: 'kora',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.publicKey || !options.secretKey) {
        throw new Error('Kora embedded checkout is not configured.');
      }

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const encodedOrderId = encodeURIComponent(input.orderId);

      return {
        provider: 'kora',
        redirectUrl: `https://mkety.com/payment/enterprise/kora?orderId=${encodedOrderId}`,
        providerCheckoutReference: reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
