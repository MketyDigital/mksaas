import {
  applyManualAdjustment,
  type ManualAdjustmentDependencies,
  type ManualAdjustmentInput,
} from './manual-adjustment-service';

const input: ManualAdjustmentInput = {
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  idempotencyKey: 'manual-2026-09-07-001',
  adjustmentType: 'payment',
  amountMinor: 1999n,
  currency: 'USD',
  reason: 'Verified offline bank transfer.',
  reference: 'bank-ref-123',
};

const actor = { userId: 'user-1' };

function makeDependencies(options?: { authorized?: boolean; duplicate?: boolean }) {
  const applied: unknown[] = [];
  const dependencies: ManualAdjustmentDependencies = {
    async canManageBilling() {
      return options?.authorized ?? true;
    },
    async applyAtomically(command) {
      applied.push(command);
      return options?.duplicate
        ? { adjustmentId: 'adjustment-existing', applied: false }
        : { adjustmentId: 'adjustment-new', applied: true };
    },
  };
  return { dependencies, applied };
}

describe('applyManualAdjustment', () => {
  it('rejects actors without current tenant billing-management permission before financial mutation', async () => {
    const { dependencies, applied } = makeDependencies({ authorized: false });

    await expect(applyManualAdjustment(dependencies, input, actor)).rejects.toThrow(
      'Actor is not authorized to manage billing for this tenant.',
    );
    expect(applied).toHaveLength(0);
  });

  it('requires a non-empty reason and idempotency key', async () => {
    const missingReason = makeDependencies();
    await expect(
      applyManualAdjustment(missingReason.dependencies, { ...input, reason: '   ' }, actor),
    ).rejects.toThrow('Manual adjustment reason is required.');
    expect(missingReason.applied).toHaveLength(0);

    const missingKey = makeDependencies();
    await expect(
      applyManualAdjustment(missingKey.dependencies, { ...input, idempotencyKey: '   ' }, actor),
    ).rejects.toThrow('Manual adjustment idempotency key is required.');
    expect(missingKey.applied).toHaveLength(0);
  });

  it('requires normalized currency and a non-zero amount', async () => {
    const badCurrency = makeDependencies();
    await expect(
      applyManualAdjustment(badCurrency.dependencies, { ...input, currency: 'usd' }, actor),
    ).rejects.toThrow('Manual adjustment currency must be a normalized ISO-style currency code.');

    const zero = makeDependencies();
    await expect(
      applyManualAdjustment(zero.dependencies, { ...input, amountMinor: 0n }, actor),
    ).rejects.toThrow('Manual adjustment amount cannot be zero.');
  });

  it('records actor and manual source for an authorized payment or waiver', async () => {
    const { dependencies, applied } = makeDependencies();

    await expect(applyManualAdjustment(dependencies, input, actor)).resolves.toEqual({
      adjustmentId: 'adjustment-new',
      applied: true,
    });

    expect(applied).toEqual([
      expect.objectContaining({
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        source: 'manual',
        adjustmentType: 'payment',
        reason: input.reason,
      }),
    ]);
  });

  it('surfaces an idempotent duplicate result without inventing a second financial effect', async () => {
    const { dependencies, applied } = makeDependencies({ duplicate: true });

    await expect(applyManualAdjustment(dependencies, input, actor)).resolves.toEqual({
      adjustmentId: 'adjustment-existing',
      applied: false,
    });
    expect(applied).toHaveLength(1);
  });
});
