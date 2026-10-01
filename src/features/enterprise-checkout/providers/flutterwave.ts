import { createCentralFlutterwaveCheckout } from '@/features/payments/central-flutterwave-broker';
import { createMketyPaymentReference } from '@/features/payments/reference';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

export function createFlutterwaveEnterpriseAdapter(options: {
  brokerSecret?: string;
  brokerUrl?: string;
  fetchImpl?: typeof fetch;
}): EnterpriseCheckoutProviderAdapter {
  return {
    provider: 'flutterwave',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.brokerSecret) throw new Error('Mkety Flutterwave payment broker is not configured.');

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const broker = await createCentralFlutterwaveCheckout(
        {
          source: 'enterprise',
          reference,
          canonicalAmountMinor: input.amountMinor,
          requestedPaymentCurrency: input.currency,
          email: input.customer.email,
          customerName: input.customer.fullName,
          orderId: input.orderId,
          redirectUrl: `https://mkety.com/payment/enterprise/success?orderId=${encodeURIComponent(input.orderId)}`,
        },
        {
          brokerSecret: options.brokerSecret,
          brokerUrl: options.brokerUrl,
          fetchImpl: options.fetchImpl,
          experience: 'inline',
        },
      );

      return {
        provider: 'flutterwave',
        redirectUrl: broker.experience === 'hosted' && broker.checkoutUrl
          ? broker.checkoutUrl
          : `https://mkety.com/payment/enterprise/flutterwave?orderId=${encodeURIComponent(input.orderId)}`,
        providerCheckoutReference: reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
