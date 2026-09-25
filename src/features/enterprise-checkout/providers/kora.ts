import type { EnterpriseCheckoutProviderAdapter, ProviderCheckoutInput } from './types';
import { buildMketyPaymentMetadata, createMketyPaymentReference } from '@/features/payments/reference';
import { formatUsdMinorUnits } from '../domain';

export function createKoraEnterpriseAdapter(options: {
  secretKey?: string;
  fetchImpl?: typeof fetch;
}): EnterpriseCheckoutProviderAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    provider: 'kora',
    async createCheckout(input: ProviderCheckoutInput) {
      if (!options.secretKey) throw new Error('Kora is not configured.');

      const uuid = input.orderId.startsWith('MKETY-ENT-') ? input.orderId.slice('MKETY-ENT-'.length) : '';
      const reference = createMketyPaymentReference('enterprise', uuid || undefined);
      const encodedOrderId = encodeURIComponent(input.orderId);
      const response = await fetchImpl('https://api.korapay.com/merchant/api/v1/charges/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(formatUsdMinorUnits(input.amountMinor)),
          currency: input.currency,
          reference,
          redirect_url: `https://mkety.com/payment/enterprise/success?orderId=${encodedOrderId}`,
          notification_url: 'https://mkety.com/api/payments/kora/webhook',
          narration: `Mkety Enterprise - ${input.project.name}`,
          customer: {
            email: input.customer.email,
            name: input.customer.fullName,
          },
          metadata: buildMketyPaymentMetadata({
            source: 'enterprise',
            orderId: input.orderId,
          }),
          merchant_bears_cost: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        data?: { reference?: string; checkout_url?: string };
      } | null;
      const redirectUrl = payload?.data?.checkout_url;
      if (!response.ok || payload?.status !== true || !redirectUrl || !redirectUrl.startsWith('https://')) {
        throw new Error('Kora checkout creation failed.');
      }

      return {
        provider: 'kora',
        redirectUrl,
        providerCheckoutReference: payload?.data?.reference ?? reference,
        status: 'checkout_created' as const,
      };
    },
  };
}
