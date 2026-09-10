import type { EnterprisePaymentProvider } from '../domain';
import { createNowPaymentsAdapter } from './nowpayments';
import { createSelarAdapter } from './selar';
import type { EnterpriseCheckoutProviderAdapter } from './types';

interface EnterpriseProviderEnvironment {
  [key: string]: string | undefined;
  NOWPAYMENTS_API_KEY?: string;
  SELAR_ENTERPRISE_CHECKOUT_URL?: string;
}

export function getEnterprisePaymentProvider(
  provider: EnterprisePaymentProvider,
  environment: EnterpriseProviderEnvironment = process.env,
): EnterpriseCheckoutProviderAdapter {
  switch (provider) {
    case 'nowpayments':
      return createNowPaymentsAdapter({ apiKey: environment.NOWPAYMENTS_API_KEY });
    case 'selar':
      return createSelarAdapter({ checkoutUrl: environment.SELAR_ENTERPRISE_CHECKOUT_URL });
  }
}
