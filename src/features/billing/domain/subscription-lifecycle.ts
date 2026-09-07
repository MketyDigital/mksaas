import type { SubscriptionStatus } from './types';

const allowedTransitions: Record<SubscriptionStatus, ReadonlySet<SubscriptionStatus>> = {
  trialing: new Set(['active', 'cancel_at_period_end', 'cancelled']),
  active: new Set(['past_due', 'paused', 'cancel_at_period_end', 'cancelled']),
  past_due: new Set(['active', 'paused', 'cancel_at_period_end', 'cancelled']),
  paused: new Set(['active', 'cancel_at_period_end', 'cancelled']),
  cancel_at_period_end: new Set(['active', 'cancelled']),
  cancelled: new Set(),
};

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return allowedTransitions[from].has(to);
}
