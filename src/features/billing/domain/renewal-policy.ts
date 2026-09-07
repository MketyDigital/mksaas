import type {
  GatewayCapabilities,
  RenewalMode,
  SubscriptionRenewalPreferences,
} from './types';

export function resolveRenewalMode(
  preferences: SubscriptionRenewalPreferences,
  capabilities: GatewayCapabilities,
): RenewalMode {
  if (!preferences.autoRenew) {
    return 'manual';
  }

  if (capabilities.supportsRecurring && capabilities.supportsAutoCharge) {
    return 'automatic';
  }

  if (capabilities.supportsRecurring && capabilities.supportsHostedSubscription) {
    return 'provider_managed';
  }

  if (capabilities.supportsRecurring && capabilities.supportsRecurringInvoice) {
    return 'invoice_required';
  }

  return 'manual';
}
