import type { ManualAdjustmentCommand } from './manual-adjustment-service';
import { createManualAdjustmentDependencies } from './manual-adjustment-dependencies';

const command: ManualAdjustmentCommand = {
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  subscriptionId: 'subscription-1',
  billingPeriodId: 'period-1',
  idempotencyKey: 'manual-001',
  adjustmentType: 'payment',
  amountMinor: 1999n,
  currency: 'USD',
  reason: 'Verified offline payment.',
  reference: 'bank-123',
  actorUserId: 'user-1',
  source: 'manual',
};

function chain(result: unknown[] = []) {
  const api: Record<string, jest.Mock> = {};
  const next = () => api;
  api.values = jest.fn(next);
  api.onConflictDoNothing = jest.fn(next);
  api.returning = jest.fn(async () => result);
  api.set = jest.fn(next);
  api.where = jest.fn(async () => []);
  return api;
}

function makeDatabase(duplicate = false) {
  const calls: string[] = [];
  let insertCount = 0;
  const tx = {
    query: {
      billingManualAdjustments: {
        findFirst: jest.fn(async () => {
          calls.push('load-existing-adjustment');
          return { id: 'adjustment-existing' };
        }),
      },
      billingPeriods: {
        findFirst: jest.fn(async () => {
          calls.push('load-period');
          return {
            id: 'period-1',
            tenantId: 'tenant-1',
            subscriptionId: 'subscription-1',
            amountDueMinor: 1999n,
            currency: 'USD',
          };
        }),
      },
      billingSubscriptions: {
        findFirst: jest.fn(async () => {
          calls.push('load-subscription');
          return { id: 'subscription-1', tenantId: 'tenant-1', status: 'active' };
        }),
      },
    },
    insert: jest.fn(() => {
      insertCount += 1;
      calls.push(insertCount === 1 ? 'insert-adjustment' : 'insert-ledger');
      return chain(insertCount === 1 && !duplicate ? [{ id: 'adjustment-new' }] : []);
    }),
    update: jest.fn(() => {
      calls.push('update-period');
      return chain();
    }),
  };
  const database = {
    transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => {
      calls.push('transaction-start');
      const result = await callback(tx);
      calls.push('transaction-end');
      return result;
    }),
  };
  return { database, calls };
}

describe('createManualAdjustmentDependencies', () => {
  it('uses the existing tenant permission resolver with the billing.manage permission key', async () => {
    const { database } = makeDatabase();
    const permissionResolver = jest.fn(async () => true);
    const dependencies = createManualAdjustmentDependencies(database as never, permissionResolver);

    await expect(dependencies.canManageBilling('acme', 'user-1')).resolves.toBe(true);
    expect(permissionResolver).toHaveBeenCalledWith('acme', 'billing.manage', 'user-1');
  });

  it('persists adjustment, ledger and period consequence inside one transaction', async () => {
    const { database, calls } = makeDatabase();
    const dependencies = createManualAdjustmentDependencies(database as never, async () => true);

    await expect(dependencies.applyAtomically(command)).resolves.toEqual({ adjustmentId: 'adjustment-new', applied: true });
    expect(calls).toEqual([
      'transaction-start',
      'insert-adjustment',
      'insert-ledger',
      'load-period',
      'update-period',
      'load-subscription',
      'transaction-end',
    ]);
  });

  it('returns an existing idempotent adjustment without appending a second financial effect', async () => {
    const { database, calls } = makeDatabase(true);
    const dependencies = createManualAdjustmentDependencies(database as never, async () => true);

    await expect(dependencies.applyAtomically(command)).resolves.toEqual({
      adjustmentId: 'adjustment-existing',
      applied: false,
    });
    expect(calls).toEqual([
      'transaction-start',
      'insert-adjustment',
      'load-existing-adjustment',
      'transaction-end',
    ]);
  });
});
