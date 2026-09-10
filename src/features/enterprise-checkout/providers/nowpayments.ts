import { formatUsdMinorUnits } from '../domain';
import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';

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
      const response = await fetchImpl('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
        },
        body: JSON.stringify({
          price_amount: priceAmount,
          price_currency: 'usd',
          order_id: input.orderId,
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

      return {
        provider: 'nowpayments',
        redirectUrl: data.invoice_url,
        providerCheckoutReference: data.id == null ? undefined : String(data.id),
        status: 'checkout_created' as const,
      };
    },
  };
}
