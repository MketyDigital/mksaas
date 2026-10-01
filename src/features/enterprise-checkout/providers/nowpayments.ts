import { createMketyPaymentReference } from '@/features/payments/reference';

import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';
import { formatUsdMinorUnits } from '../domain';

interface CreateNowPaymentsAdapterOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export function createNowPaymentsAdapter(options: CreateNowPaymentsAdapterOptions): EnterpriseCheckoutProviderAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    provider: 'nowpayments',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.apiKey) throw new Error('NOWPayments is not configured.');

      const priceAmount = Number(formatUsdMinorUnits(input.amountMinor));
      const encodedOrderId = encodeURIComponent(input.orderId);
      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const orderReference = createMketyPaymentReference('enterprise', uuid || undefined);
      const response = await fetchImpl('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
        },
        body: JSON.stringify({
          price_amount: priceAmount,
          price_currency: 'usd',
          order_id: orderReference,
          order_description: `Mkety Enterprise - ${input.project.name} (${input.customer.companyName})`,
          ipn_callback_url: 'https://mkety.com/api/webhooks/enterprise/nowpayments',
          success_url: `https://mkety.com/payment/enterprise/success?orderId=${encodedOrderId}`,
          cancel_url: `https://mkety.com/payment/enterprise/cancelled?orderId=${encodedOrderId}`,
        }),
      });

      if (!response.ok) throw new Error('NOWPayments invoice creation failed.');
      const data = (await response.json()) as { id?: string | number; invoice_url?: string };
      if (!data.invoice_url || !data.invoice_url.startsWith('https://')) {
        throw new Error('NOWPayments returned an invalid invoice URL.');
      }

      if (data.id == null) {
        throw new Error('NOWPayments returned an invalid invoice identifier.');
      }
      const invoiceId = String(data.id);

      return {
        provider: 'nowpayments',
        redirectUrl: `https://mkety.com/payment/nowpayments?iid=${encodeURIComponent(invoiceId)}`,
        providerCheckoutReference: invoiceId,
        status: 'checkout_created' as const,
      };
    },
  };
}
