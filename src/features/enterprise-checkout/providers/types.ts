import type { EnterpriseCheckoutRequest, EnterprisePaymentProvider } from '../domain';

export interface ProviderCheckoutInput extends EnterpriseCheckoutRequest {
  orderId: string;
}

export interface ProviderCheckoutResult {
  provider: EnterprisePaymentProvider;
  redirectUrl: string;
  providerCheckoutReference?: string;
  status: 'checkout_created' | 'awaiting_confirmation';
}

export interface EnterpriseCheckoutProviderAdapter {
  provider: EnterprisePaymentProvider;
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
}
