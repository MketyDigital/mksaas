import type { GatewayCapabilities } from '../domain/types';
import {
  prepareRenewal,
  recordUnsettledRenewal,
  type RenewalRepository,
  type RenewalSubscription,
} from './renewal-service';

const baseCapabilities: GatewayCapabilities = {
  supportsRecurring: true,
  supportsAutoCharge: false,
  supportsHostedSubscription: false,
  supportsRecurringInvoice: false,
  supportsWebhookVerification: true,
  supportsRefunds: true,
  supportsPartialPayment: false,
  supportsMultipleCurrencies: true,
};

const subscription: RenewalSubscription = {
  id: 'subscription-1',
  tenantId: 'tenant-1',
  billingPeriodId: 'period-next',
  status: 'active',
  autoRenew: true,
  gatewayProvider: 'selar',
};

function makeRepository() {
  const prepared: unknown[] = [];
  const pastDue: unknown[] = [];
  const repository: RenewalRepository = {
    async recordPreparedAttempt(input) {
      prepared.push(input);
      return { attemptId: 'attempt-1' };
    },
    async markPastDue(input) {
      pastDue.push(input);
    },
  };
  return { repository, prepared, pastDue };
}

describe('prepareRenewal', () => {
  it.each([
    ['manual', false, baseCapabilities],
    ['automatic', true, { ...baseCapabilities, supportsAutoCharge: true }],
    ['provider_managed', true, { ...baseCapabilities, supportsHostedSubscription: true }],
    ['invoice_required', true, { ...baseCapabilities, supportsRecurringInvoice: true }],
    ['manual', true, { ...baseCapabilities, supportsRecurring: false }],
  ] as const)('records %s renewal mode from preferences and capabilities', async (expected, autoRenew, capabilities) => {
    const { repository, prepared } = makeRepository();

    await expect(
      prepareRenewal(repository, { ...subscription, autoRenew }, capabilities, new Date('2026-09-07T12:00:00.000Z')),
    ).resolves.toMatchObject({ attemptId: 'attempt-1', mode: expected });

    expect(prepared).toEqual([
      expect.objectContaining({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        mode: expected,
      }),
    ]);
  });
});

describe('recordUnsettledRenewal', () => {
  it('moves an eligible active subscription to past_due with explicit grace-period data', async () => {
    const { repository, pastDue } = makeRepository();
    const now = new Date('2026-09-07T12:00:00.000Z');

    await recordUnsettledRenewal(repository, subscription, now, 7);

    expect(pastDue).toEqual([
      {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        status: 'past_due',
        gracePeriodEnd: new Date('2026-09-14T12:00:00.000Z'),
        updatedAt: now,
      },
    ]);
  });

  it('does not resurrect a cancelled subscription into past_due', async () => {
    const { repository, pastDue } = makeRepository();

    await expect(
      recordUnsettledRenewal(repository, { ...subscription, status: 'cancelled' }, new Date(), 7),
    ).rejects.toThrow('Cancelled subscriptions cannot enter renewal grace.');
    expect(pastDue).toHaveLength(0);
  });
});
