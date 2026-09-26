import { createFlutterwaveEnterpriseAdapter } from './flutterwave';
import { createKoraEnterpriseAdapter } from './kora';
import { createNowPaymentsAdapter } from './nowpayments';
import { createSelarAdapter } from './selar';
import type { EnterpriseCheckoutProviderAdapter } from './types';
import type { EnterprisePaymentProvider } from '../domain';

interface EnterpriseProviderEnvironment {
  [key: string]: string | undefined;
  NOWPAYMENTS_API_KEY?: string;
  FLUTTERWAVE_PUBLIC_KEY?: string;
  FLUTTERWAVE_STANDARD_SECRET_KEY?: string;
  FLUTTERWAVE_STANDARD_WEBHOOK_HASH?: string;
  KORA_SECRET_KEY?: string;
  SELAR_ENTERPRISE_CHECKOUT_URL?: string;
}

export function getEnterprisePaymentProvider(
  provider: EnterprisePaymentProvider,
  environment: EnterpriseProviderEnvironment = process.env,
): EnterpriseCheckoutProviderAdapter {
  switch (provider) {
    case 'nowpayments':
      return createNowPaymentsAdapter({ apiKey: environment.NOWPAYMENTS_API_KEY });
    case 'flutterwave':
      if (!environment.FLUTTERWAVE_STANDARD_SECRET_KEY || !environment.FLUTTERWAVE_STANDARD_WEBHOOK_HASH) {
        throw new Error('Flutterwave hosted checkout is not fully configured.');
      }
      return createFlutterwaveEnterpriseAdapter({ standardSecretKey: environment.FLUTTERWAVE_STANDARD_SECRET_KEY });
    case 'kora':
      return createKoraEnterpriseAdapter({ secretKey: environment.KORA_SECRET_KEY });
    case 'selar':
      return createSelarAdapter({ checkoutUrl: environment.SELAR_ENTERPRISE_CHECKOUT_URL });
  }
}
