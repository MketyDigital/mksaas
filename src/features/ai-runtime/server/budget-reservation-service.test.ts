import {
  AI_BUDGET_RESERVATION_ERROR_CODES,
} from './budget-reservation-engine';
import {
  createAiBudgetReservationService,
  type ReserveAiBudgetInput,
} from './budget-reservation-service';
import type {
  AiBudgetReservationSource,
  AiBudgetReservationTransaction,
  NewStoredAiBudgetReservation,
  StoredAiBudget,
  StoredAiBudgetReservation,
} from './budget-reservation-source';

class FakeAiBudgetReservationSource implements AiBudgetReservationSource {
  budgets: StoredAiBudget[] = [];
  reservations: StoredAiBudgetReservation[] = [];
  private queue = Promise.resolve();
  private sequence = 0;

  async transaction<T>(work: (tx: AiBudgetReservationTransaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const budgetSnapshot = this.budgets.map((budget) => ({ ...budget }));
    const reservationSnapshot = this.reservations.map((reservation) => ({ ...reservation }));

    const tx: AiBudgetReservationTransaction = {
      listApplicableBudgets: async ({ tenantId, projectId, apiKeyId, now }) =>
        this.budgets.filter((budget) =>
          budget.tenantId === tenantId &&
          budget.startsAt <= now &&
          budget.endsAt > now &&
          (budget.projectId === null || budget.projectId === projectId) &&
          (budget.apiKeyId === null || budget.apiKeyId === apiKeyId)
        ),

      findReservationsByIdempotency: async (tenantId, idempotencyKey) =>
        this.reservations.filter(
          (reservation) =>
            reservation.tenantId === tenantId &&
            reservation.idempotencyKey === idempotencyKey,
        ),

      getReservations: async (tenantId, reservationIds) =>
        this.reservations.filter(
          (reservation) =>
            reservation.tenantId === tenantId &&
            reservationIds.includes(reservation.id),
        ),

      applyBudgetHold: async (budgetId, credits, requests) => {
        const budget = this.budgets.find((candidate) => candidate.id === budgetId);
        if (!budget) return null;

        const creditExceeded =
          budget.maxCredits !== null &&
          budget.usedCredits + budget.reservedCredits + credits > budget.maxCredits;
        const requestExceeded =
          budget.maxRequests !== null &&
          budget.usedRequests + budget.reservedRequests + requests > budget.maxRequests;
        if (budget.hardStop && (creditExceeded || requestExceeded)) return null;

        budget.reservedCredits += credits;
        budget.reservedRequests += requests;
        return { ...budget };
      },

      applyBudgetSettlement: async (
        budgetId,
        reservedCredits,
        reservedRequests,
        actualCredits,
        actualRequests,
      ) => {
        const budget = this.budgets.find((candidate) => candidate.id === budgetId);
        if (
          !budget ||
          budget.reservedCredits < reservedCredits ||
          budget.reservedRequests < reservedRequests
        ) {
          return null;
        }
        budget.reservedCredits -= reservedCredits;
        budget.reservedRequests -= reservedRequests;
        budget.usedCredits += actualCredits;
        budget.usedRequests += actualRequests;
        return { ...budget };
      },

      applyBudgetRelease: async (budgetId, reservedCredits, reservedRequests) => {
        const budget = this.budgets.find((candidate) => candidate.id === budgetId);
        if (
          !budget ||
          budget.reservedCredits < reservedCredits ||
          budget.reservedRequests < reservedRequests
        ) {
          return null;
        }
        budget.reservedCredits -= reservedCredits;
        budget.reservedRequests -= reservedRequests;
        return { ...budget };
      },

      insertReservation: async (input: NewStoredAiBudgetReservation) => {
        const now = new Date();
        const reservation: StoredAiBudgetReservation = {
          id: `budget-reservation-${++this.sequence}`,
          ...input,
          settledCredits: input.settledCredits ?? null,
          settledRequests: input.settledRequests ?? null,
          settledAt: input.settledAt ?? null,
          releasedAt: input.releasedAt ?? null,
          releaseReason: input.releaseReason ?? null,
          createdAt: now,
          updatedAt: now,
        };
        this.reservations.push(reservation);
        return { ...reservation };
      },

      claimSettlement: async (input) => {
        const reservation = this.reservations.find(
          (candidate) =>
            candidate.tenantId === input.tenantId &&
            candidate.id === input.reservationId &&
            candidate.status === 'held',
        );
        if (!reservation) return null;
        reservation.status = 'settled';
        reservation.settledCredits = input.actualCredits;
        reservation.settledRequests = input.actualRequests;
        reservation.settledAt = input.settledAt;
        reservation.updatedAt = input.settledAt;
        return { ...reservation };
      },

      claimRelease: async (input) => {
        const reservation = this.reservations.find(
          (candidate) =>
            candidate.tenantId === input.tenantId &&
            candidate.id === input.reservationId &&
            candidate.status === 'held',
        );
        if (!reservation) return null;
        reservation.status = 'released';
        reservation.releaseReason = input.reason;
        reservation.releasedAt = input.releasedAt;
        reservation.updatedAt = input.releasedAt;
        return { ...reservation };
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.budgets = budgetSnapshot;
      this.reservations = reservationSnapshot;
      throw error;
    } finally {
      release();
    }
  }
}

function budget(overrides: Partial<StoredAiBudget> = {}): StoredAiBudget {
  return {
    id: 'budget-tenant',
    tenantId: 'tenant-a',
    projectId: null,
    apiKeyId: null,
    maxCredits: 100n,
    maxRequests: 10n,
    usedCredits: 0n,
    usedRequests: 0n,
    reservedCredits: 0n,
    reservedRequests: 0n,
    hardStop: true,
    startsAt: new Date('2026-09-01T00:00:00.000Z'),
    endsAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function reserveInput(overrides: Partial<ReserveAiBudgetInput> = {}): ReserveAiBudgetInput {
  return {
    tenantId: 'tenant-a',
    projectId: 'project-a',
    apiKeyId: 'key-a',
    requestId: 'request-a',
    creditReservationId: 'credit-a',
    reservedCredits: 40n,
    reservedRequests: 1n,
    idempotencyKey: 'idem-a',
    now: new Date('2026-09-28T12:00:00.000Z'),
    expiresAt: new Date('2026-09-28T12:02:00.000Z'),
    ...overrides,
  };
}

describe('AI budget reservation service', () => {
  it('reserves every applicable hierarchical budget atomically', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [
      budget(),
      budget({ id: 'budget-project', projectId: 'project-a', maxCredits: 70n }),
      budget({ id: 'budget-key', apiKeyId: 'key-a', maxCredits: 60n }),
    ];
    const service = createAiBudgetReservationService(source);

    const result = await service.reserve(reserveInput());

    expect(result.reservations).toHaveLength(3);
    expect(source.budgets.map((item) => item.reservedCredits)).toEqual([40n, 40n, 40n]);
  });

  it('rolls back all holds when any applicable hard-stop budget is exhausted', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [
      budget(),
      budget({ id: 'budget-project', projectId: 'project-a', maxCredits: 30n }),
    ];
    const service = createAiBudgetReservationService(source);

    await expect(service.reserve(reserveInput())).rejects.toMatchObject({
      code: AI_BUDGET_RESERVATION_ERROR_CODES.budgetExhausted,
    });

    expect(source.budgets.map((item) => item.reservedCredits)).toEqual([0n, 0n]);
    expect(source.reservations).toHaveLength(0);
  });

  it('allows a soft budget to track overage without blocking', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [
      budget({ maxCredits: 20n, hardStop: false }),
    ];
    const service = createAiBudgetReservationService(source);

    await expect(service.reserve(reserveInput())).resolves.toMatchObject({
      reservations: [expect.objectContaining({ status: 'held' })],
    });
    expect(source.budgets[0]?.reservedCredits).toBe(40n);
  });

  it('replays the same reservation group without double reserving', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [budget()];
    const service = createAiBudgetReservationService(source);

    const first = await service.reserve(reserveInput());
    const replay = await service.reserve(reserveInput());

    expect(replay).toEqual(first);
    expect(source.budgets[0]?.reservedCredits).toBe(40n);
    expect(source.reservations).toHaveLength(1);
  });

  it('settles reserved counters into exact used counters', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [budget()];
    const service = createAiBudgetReservationService(source);
    await service.reserve(reserveInput({ reservedCredits: 50n }));

    const result = await service.settle({
      tenantId: 'tenant-a',
      idempotencyKey: 'idem-a',
      actualCredits: 17n,
      actualRequests: 1n,
    });

    expect(result.reservations[0]).toMatchObject({
      status: 'settled',
      settledCredits: 17n,
    });
    expect(source.budgets[0]).toMatchObject({
      reservedCredits: 0n,
      reservedRequests: 0n,
      usedCredits: 17n,
      usedRequests: 1n,
    });
  });

  it('releases all reserved counters without usage', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [budget()];
    const service = createAiBudgetReservationService(source);
    await service.reserve(reserveInput());

    await service.release({
      tenantId: 'tenant-a',
      idempotencyKey: 'idem-a',
      reason: 'provider_failure',
    });

    expect(source.budgets[0]).toMatchObject({
      reservedCredits: 0n,
      reservedRequests: 0n,
      usedCredits: 0n,
      usedRequests: 0n,
    });
    expect(source.reservations[0]).toMatchObject({ status: 'released' });
  });

  it('prevents two concurrent requests from bypassing a shared hard budget', async () => {
    const source = new FakeAiBudgetReservationSource();
    source.budgets = [budget({ maxCredits: 60n })];
    const service = createAiBudgetReservationService(source);

    const results = await Promise.allSettled([
      service.reserve(reserveInput({ idempotencyKey: 'idem-a', reservedCredits: 40n })),
      service.reserve(reserveInput({ idempotencyKey: 'idem-b', requestId: 'request-b', reservedCredits: 40n })),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(source.budgets[0]?.reservedCredits).toBe(40n);
  });
});
