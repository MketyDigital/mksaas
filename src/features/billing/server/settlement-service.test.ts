import type { NormalizedSettlement } from '../domain/settlement';
import type { BillingRepository } from './repository';
import { applyVerifiedSettlement } from './settlement-service';

const settlement: NormalizedSettlement = {
  provider: 'nowpayments',
  providerPaymentId: 'payment-123',
  providerEventId: 'event-123',
  subscriptionId: 'subscription-123',
  billingPeriodId: 'period-123',
  amountExpectedMinor: 1999n,
  currencyExpected: 'USD',
  amountPaidMinor: 1999n,
  currencyPaid: 'USD',
  status: 'verified_success',
  occurredAt: new Date('2026-09-07T12:00:00.000Z'),
};

function makeRepository(): BillingRepository & { ledgerPayments: number } {
  const appliedEvents = new Map<string, string>();
  let nextId = 1;

  return {
    ledgerPayments: 0,
    async applyVerifiedSettlementAtomically(input, appliedAt) {
      const identity = `${input.provider}:${input.providerEventId ?? input.providerPaymentId}`;
      const existing = appliedEvents.get(identity);
      if (existing) {
        return { settlementId: existing, applied: false };
      }

      const settlementId = `settlement-${nextId++}`;
      appliedEvents.set(identity, settlementId);
      this.ledgerPayments += 1;
      expect(appliedAt).toBeInstanceOf(Date);
      return { settlementId, applied: true };
    },
  };
}

describe('applyVerifiedSettlement', () => {
  it('applies one verified provider event exactly once', async () => {
    const repository = makeRepository();
    const appliedAt = new Date('2026-09-07T13:00:00.000Z');

    const first = await applyVerifiedSettlement(repository, settlement, appliedAt);
    const replay = await applyVerifiedSettlement(repository, settlement, appliedAt);

    expect(first).toEqual({ status: 'applied', settlementId: 'settlement-1' });
    expect(replay).toEqual({ status: 'duplicate', settlementId: 'settlement-1' });
    expect(repository.ledgerPayments).toBe(1);
  });

  it('rejects unverified failure before repository mutation', async () => {
    const repository = makeRepository();

    await expect(
      applyVerifiedSettlement(repository, { ...settlement, status: 'verified_failure' }),
    ).rejects.toThrow('Settlement is not a verified success.');
    expect(repository.ledgerPayments).toBe(0);
  });

  it('requires an external provider identity for replay protection', async () => {
    const repository = makeRepository();

    await expect(
      applyVerifiedSettlement(repository, {
        ...settlement,
        providerPaymentId: undefined,
        providerEventId: undefined,
      }),
    ).rejects.toThrow('Verified gateway settlement requires a provider event or payment ID.');
    expect(repository.ledgerPayments).toBe(0);
  });
});
