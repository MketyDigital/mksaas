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
  FLUTTERWAVE_CHECKOUT_BROKER_SECRET?: string;
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
        !environment.FLUTTERWAVE_STANDARD_WEBHOOK_HASH ||
        !environment.FLUTTERWAVE_CHECKOUT_BROKER_SECRET
      ) {
        throw new Error('Mkety Flutterwave payment broker is not fully configured.');
      }
      return createFlutterwaveEnterpriseAdapter({
        brokerSecret: environment.FLUTTERWAVE_CHECKOUT_BROKER_SECRET,
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
