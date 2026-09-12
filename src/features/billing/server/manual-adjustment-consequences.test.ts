import type { ManualAdjustmentCommand } from './manual-adjustment-service';
import { applyManualAdjustmentConsequences } from './manual-adjustment-consequences';

const baseCommand: ManualAdjustmentCommand = {
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  idempotencyKey: 'manual-001',
  adjustmentType: 'payment',
  amountMinor: 1999n,
  currency: 'USD',
  reason: 'Verified offline payment.',
  actorUserId: 'user-1',
  source: 'manual',
};

function updateChain() {
  const api: Record<string, jest.Mock> = {};
  api.set = jest.fn(() => api);
  api.where = jest.fn(async () => []);
  return api;
}

function makeTransaction(period = { amountDueMinor: 1999n, currency: 'USD' }, subscriptionStatus = 'past_due') {
  const updates: Array<Record<string, jest.Mock>> = [];
  return {
    updates,
    tx: {
      query: {
        billingPeriods: {
          findFirst: jest.fn(async () => ({
            id: 'period-1',
            tenantId: 'tenant-1',
            subscriptionId: 'subscription-1',
            ...period,
          })),
        },
        billingSubscriptions: {
          findFirst: jest.fn(async () => ({ id: 'subscription-1', tenantId: 'tenant-1', status: subscriptionStatus })),
        },
      },
      update: jest.fn(() => {
        const chain = updateChain();
        updates.push(chain);
        return chain;
      }),
    },
  };
}

describe('applyManualAdjustmentConsequences', () => {
  it('marks a fully covered manual payment paid and recovers a past-due subscription', async () => {
    const { tx, updates } = makeTransaction();
    await applyManualAdjustmentConsequences(tx as never, baseCommand);

    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ collectionStatus: 'paid' }));
    expect(updates[1].set).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', gracePeriodEnd: null }));
  });

  it('marks a fully covered waiver as waived', async () => {
    const { tx, updates } = makeTransaction();
    await applyManualAdjustmentConsequences(tx as never, { ...baseCommand, adjustmentType: 'waiver' });
    expect(updates[0].set).toHaveBeenCalledWith(expect.objectContaining({ collectionStatus: 'waived' }));
  });

  it('does not close the period for a partial payment', async () => {
    const { tx } = makeTransaction();
    await applyManualAdjustmentConsequences(tx as never, { ...baseCommand, amountMinor: 1000n });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('fails closed when manual money does not match authoritative period currency', async () => {
    const { tx } = makeTransaction();
    await expect(applyManualAdjustmentConsequences(tx as never, { ...baseCommand, currency: 'NGN' })).rejects.toThrow('currency');
    expect(tx.update).not.toHaveBeenCalled();
  });
});
