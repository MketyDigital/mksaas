import { createDrizzleRenewalRepository } from './drizzle-renewal-repository';

function chain(result: unknown[] = []) {
  const api: Record<string, jest.Mock> = {};
  const next = () => api;
  api.values = jest.fn(next);
  api.set = jest.fn(next);
  api.where = jest.fn(next);
  api.returning = jest.fn(async () => result);
  return api;
}

describe('createDrizzleRenewalRepository', () => {
  it('records a prepared renewal attempt inside a database transaction', async () => {
    const tx = { insert: jest.fn(() => chain([{ id: 'attempt-1' }])) };
    const database = { transaction: jest.fn(async (callback: any) => callback(tx)) };
    const repository = createDrizzleRenewalRepository(database as never);

    await expect(repository.recordPreparedAttempt({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      billingPeriodId: 'period-1',
      mode: 'invoice_required',
      provider: 'nowpayments',
      status: 'prepared',
      attemptedAt: new Date('2026-09-07T12:00:00.000Z'),
    })).resolves.toEqual({ attemptId: 'attempt-1' });

    expect(database.transaction).toHaveBeenCalledTimes(1);
  });

  it('uses current persisted subscription state before applying past-due grace', async () => {
    const updateChain = chain();
    const tx = {
      query: {
        billingSubscriptions: {
          findFirst: jest.fn(async () => ({ id: 'subscription-1', tenantId: 'tenant-1', status: 'active' })),
        },
      },
      update: jest.fn(() => updateChain),
    };
    const database = { transaction: jest.fn(async (callback: any) => callback(tx)) };
    const repository = createDrizzleRenewalRepository(database as never);

    await repository.markPastDue({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      status: 'past_due',
      gracePeriodEnd: new Date('2026-09-10T12:00:00.000Z'),
      updatedAt: new Date('2026-09-07T12:00:00.000Z'),
    });

    expect(tx.query.billingSubscriptions.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'past_due',
      gracePeriodEnd: new Date('2026-09-10T12:00:00.000Z'),
    }));
  });

  it('fails closed if current DB truth says the subscription is cancelled', async () => {
    const tx = {
      query: {
        billingSubscriptions: {
          findFirst: jest.fn(async () => ({ id: 'subscription-1', tenantId: 'tenant-1', status: 'cancelled' })),
        },
      },
      update: jest.fn(),
    };
    const database = { transaction: jest.fn(async (callback: any) => callback(tx)) };
    const repository = createDrizzleRenewalRepository(database as never);

    await expect(repository.markPastDue({
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
      status: 'past_due',
      gracePeriodEnd: new Date('2026-09-10T12:00:00.000Z'),
      updatedAt: new Date('2026-09-07T12:00:00.000Z'),
    })).rejects.toThrow('cancelled');
    expect(tx.update).not.toHaveBeenCalled();
  });
});
