export type BillingInterval = 'monthly' | 'yearly' | 'one_time' | 'custom';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancel_at_period_end'
  | 'cancelled';

export type RenewalMode = 'automatic' | 'provider_managed' | 'invoice_required' | 'manual';

export interface GatewayCapabilities {
  supportsRecurring: boolean;
  supportsAutoCharge: boolean;
  supportsHostedSubscription: boolean;
  supportsRecurringInvoice: boolean;
  supportsWebhookVerification: boolean;
  supportsRefunds: boolean;
  supportsPartialPayment: boolean;
  supportsMultipleCurrencies: boolean;
}

export interface SubscriptionRenewalPreferences {
  autoRenew: boolean;
}
