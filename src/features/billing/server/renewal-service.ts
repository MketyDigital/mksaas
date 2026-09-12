import { resolveRenewalMode } from '../domain/renewal-policy';
import type { GatewayCapabilities, RenewalMode, SubscriptionStatus } from '../domain/types';

export interface RenewalSubscription {
  id: string;
  tenantId: string;
  billingPeriodId: string | null;
  status: SubscriptionStatus;
  autoRenew: boolean;
  gatewayProvider: string | null;
}

export interface RenewalPreparedAttemptInput {
  tenantId: string;
  subscriptionId: string;
  billingPeriodId: string | null;
  mode: RenewalMode;
  provider: string | null;
  status: 'prepared';
  attemptedAt: Date;
}

export interface RenewalPastDueInput {
  tenantId: string;
  subscriptionId: string;
  status: 'past_due';
  gracePeriodEnd: Date;
  updatedAt: Date;
}

export interface RenewalRepository {
  recordPreparedAttempt(input: RenewalPreparedAttemptInput): Promise<{ attemptId: string }>;
  markPastDue(input: RenewalPastDueInput): Promise<void>;
}

export async function prepareRenewal(
  repository: RenewalRepository,
  subscription: RenewalSubscription,
  capabilities: GatewayCapabilities,
  now: Date,
): Promise<{ attemptId: string; mode: RenewalMode }> {
  if (subscription.status === 'cancelled') {
    throw new Error('Cancelled subscriptions cannot be renewed.');
  }

  const mode = resolveRenewalMode({ autoRenew: subscription.autoRenew }, capabilities);
  const attempt = await repository.recordPreparedAttempt({
    tenantId: subscription.tenantId,
    subscriptionId: subscription.id,
    billingPeriodId: subscription.billingPeriodId,
    mode,
    provider: subscription.gatewayProvider,
    status: 'prepared',
    attemptedAt: now,
  });

  return { attemptId: attempt.attemptId, mode };
}

export async function recordUnsettledRenewal(
  repository: RenewalRepository,
  subscription: RenewalSubscription,
  now: Date,
  gracePeriodDays: number,
): Promise<void> {
  if (subscription.status === 'cancelled') {
    throw new Error('Cancelled subscriptions cannot enter renewal grace.');
  }

  if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
    throw new Error('Renewal grace period must be a non-negative whole number of days.');
  }

  const gracePeriodEnd = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  await repository.markPastDue({
    tenantId: subscription.tenantId,
    subscriptionId: subscription.id,
    status: 'past_due',
    gracePeriodEnd,
    updatedAt: now,
  });
}
