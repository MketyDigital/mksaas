import { createFlutterwaveEnterpriseAdapter } from './flutterwave';
import { createKoraEnterpriseAdapter } from './kora';
import { createNowPaymentsAdapter } from './nowpayments';
import type { EnterpriseCheckoutProviderAdapter } from './types';
import type { EnterprisePaymentProvider } from '../domain';

interface EnterpriseProviderEnvironment {
  [key: string]: string | undefined;
  NOWPAYMENTS_API_KEY?: string;
  FLUTTERWAVE_PUBLIC_KEY?: string;
  FLUTTERWAVE_STANDARD_SECRET_KEY?: string;
  FLUTTERWAVE_STANDARD_WEBHOOK_HASH?: string;
  KORA_PUBLIC_KEY?: string;
  KORA_SECRET_KEY?: string;
}

export function getEnterprisePaymentProvider(
  provider: EnterprisePaymentProvider,
  environment: EnterpriseProviderEnvironment = process.env,
): EnterpriseCheckoutProviderAdapter {
  switch (provider) {
    case 'nowpayments':
      return createNowPaymentsAdapter({ apiKey: environment.NOWPAYMENTS_API_KEY });
    case 'flutterwave':
      if (
        !environment.FLUTTERWAVE_PUBLIC_KEY ||
        !environment.FLUTTERWAVE_STANDARD_SECRET_KEY ||
        !environment.FLUTTERWAVE_STANDARD_WEBHOOK_HASH
      ) {
        throw new Error('Flutterwave Inline is not fully configured.');
      }
      return createFlutterwaveEnterpriseAdapter({
        publicKey: environment.FLUTTERWAVE_PUBLIC_KEY,
        standardSecretKey: environment.FLUTTERWAVE_STANDARD_SECRET_KEY,
      });
    case 'kora':
      if (!environment.KORA_PUBLIC_KEY || !environment.KORA_SECRET_KEY) {
        throw new Error('Kora embedded checkout is not fully configured.');
      }
      return createKoraEnterpriseAdapter({
        publicKey: environment.KORA_PUBLIC_KEY,
        secretKey: environment.KORA_SECRET_KEY,
      });
  }
}
