import { formatUsdMinorUnits } from '../domain';
import type { EnterpriseCheckoutProviderAdapter } from './types';

interface CreateSelarAdapterOptions {
  checkoutUrl?: string;
}

export function createSelarAdapter(options: CreateSelarAdapterOptions): EnterpriseCheckoutProviderAdapter {
  if (!options.checkoutUrl) throw new Error('Selar is not configured.');

  const configuredUrl = new URL(options.checkoutUrl);
  if (configuredUrl.protocol !== 'https:') throw new Error('Selar checkout URL must use HTTPS.');

  return {
    provider: 'selar',
    async createCheckout(input) {
      const url = new URL(configuredUrl.toString());
      url.searchParams.set('add_to_cart', '1');
      url.searchParams.set('email', input.customer.email);
      url.searchParams.set('fullname', input.customer.fullName);
      if (input.customer.phone) url.searchParams.set('mobile', input.customer.phone);
      url.searchParams.set('orderId', input.orderId);
      url.searchParams.set('amount', formatUsdMinorUnits(input.amountMinor));

      return {
        provider: 'selar',
        redirectUrl: url.toString(),
        status: 'awaiting_confirmation' as const,
      };
    },
  };
}
