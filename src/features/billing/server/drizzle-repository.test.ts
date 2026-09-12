import type { NormalizedSettlement } from '../domain/settlement';
import { createDrizzleBillingRepository } from './drizzle-repository';

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

function chain(result: unknown[] = []) {
  const api: Record<string, jest.Mock> = {};
  const next = () => api;
  api.values = jest.fn(next);
  api.onConflictDoNothing = jest.fn(next);
  api.returning = jest.fn(async () => result);
  api.set = jest.fn(next);
  api.where = jest.fn(async () => result);
  return api;
}

function makeDatabase(options?: { duplicate?: boolean }) {
  const calls: string[] = [];
  const period = {
    id: 'period-123',
    tenantId: 'tenant-123',
    subscriptionId: 'subscription-123',
    periodEnd: new Date('2026-10-07T12:00:00.000Z'),
    amountDueMinor: 1999n,
    currency: 'USD',
  };

  const insertResults = options?.duplicate ? [[]] : [[{ id: 'settlement-new' }]];
  let insertIndex = 0;

  const tx = {
    query: {
      billingPeriods: {
        findFirst: jest.fn(async () => {
          calls.push('load-context');
          return period;
        }),
      },
      billingSettlements: {
        findFirst: jest.fn(async () => {
          calls.push('load-existing-settlement');
          return { id: 'settlement-existing' };
        }),
      },
    },
    insert: jest.fn(() => {
      const result = insertResults[insertIndex] ?? [];
      insertIndex += 1;
      calls.push(insertIndex === 1 ? 'insert-settlement' : 'insert-ledger');
      return chain(result);
    }),
    update: jest.fn(() => {
      const updateNumber = calls.filter((call) => call.startsWith('update-')).length + 1;
      const labels = ['update-period', 'update-subscription', 'update-settlement'];
      calls.push(labels[updateNumber - 1] ?? 'update-other');
      return chain();
    }),
  };

  const database = {
    transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      calls.push('transaction-start');
      const result = await callback(tx);
      calls.push('transaction-end');
      return result;
    }),
  };

  return { database, tx, calls };
}

describe('createDrizzleBillingRepository', () => {
  it('applies verified settlement, ledger and billing state inside one database transaction', async () => {
    const { database, calls } = makeDatabase();
    const repository = createDrizzleBillingRepository(database as never);

    await expect(
      repository.applyVerifiedSettlementAtomically(settlement, new Date('2026-09-07T13:00:00.000Z')),
    ).resolves.toEqual({ settlementId: 'settlement-new', applied: true });

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'transaction-start',
      'load-context',
      'insert-settlement',
      'insert-ledger',
      'update-period',
      'update-subscription',
      'update-settlement',
      'transaction-end',
    ]);
  });

  it('uses the database uniqueness result to return a replay without a second ledger or state mutation', async () => {
    const { database, tx, calls } = makeDatabase({ duplicate: true });
    const repository = createDrizzleBillingRepository(database as never);

    await expect(repository.applyVerifiedSettlementAtomically(settlement, new Date())).resolves.toEqual({
      settlementId: 'settlement-existing',
      applied: false,
    });

    expect(tx.query.billingSettlements.findFirst).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'transaction-start',
      'load-context',
      'insert-settlement',
      'load-existing-settlement',
      'transaction-end',
    ]);
  });
});
