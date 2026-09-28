import {
  AI_COMMERCIAL_ADMISSION_ERROR_CODES,
  type AiCommercialAdmissionDependencies,
  createAiCommercialAdmissionService,
} from './commercial-admission';

function creditReservation(id = 'credit-reservation-1') {
  return {
    reservation: {
      id,
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      requestId: 'request-a',
      idempotencyKey: 'idem-a',
      fingerprint: 'fingerprint',
      status: 'held' as const,
      reservedCredits: 50n,
      settledCredits: null,
      holdLedgerEntryId: 'ledger-hold',
      releaseLedgerEntryId: null,
      usageEventId: null,
      expiresAt: new Date('2026-09-28T12:02:00Z'),
      settledAt: null,
      releasedAt: null,
      releaseReason: null,
      createdAt: new Date('2026-09-28T12:00:00Z'),
      updatedAt: new Date('2026-09-28T12:00:00Z'),
    },
    balance: {
      tenantId: 'tenant-a',
      availableCredits: 50n,
      lifetimeGranted: 100n,
      lifetimeConsumed: 0n,
      updatedAt: new Date('2026-09-28T12:00:00Z'),
    },
  };
}

function budgetResult() {
  return {
    reservations: [{
      id: 'budget-reservation-1',
      tenantId: 'tenant-a',
      budgetId: 'budget-a',
      requestId: 'request-a',
      creditReservationId: 'credit-reservation-1',
      idempotencyKey: 'idem-a',
      fingerprint: 'budget-fingerprint',
      status: 'held' as const,
      reservedCredits: 50n,
      reservedRequests: 1n,
      settledCredits: null,
      settledRequests: null,
      expiresAt: new Date('2026-09-28T12:02:00Z'),
      settledAt: null,
      releasedAt: null,
      releaseReason: null,
      createdAt: new Date('2026-09-28T12:00:00Z'),
      updatedAt: new Date('2026-09-28T12:00:00Z'),
    }],
  };
}

function dependencies(overrides: Partial<AiCommercialAdmissionDependencies> = {}) {
  return {
    reserveCredits: jest.fn(async () => creditReservation()),
    releaseCredits: jest.fn(async () => creditReservation()),
    reserveBudget: jest.fn(async () => budgetResult()),
    releaseBudget: jest.fn(async () => budgetResult()),
    ...overrides,
  } satisfies AiCommercialAdmissionDependencies;
}

describe('AI commercial admission orchestrator', () => {
  it('requires both prepaid credit and every applicable budget hold before admission succeeds', async () => {
    const deps = dependencies();
    const service = createAiCommercialAdmissionService(deps);

    const result = await service.admit({
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      requestId: 'request-a',
      idempotencyKey: 'idem-a',
      reservedCredits: 50n,
    });

    expect(deps.reserveCredits).toHaveBeenCalledTimes(1);
    expect(deps.reserveBudget).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      creditReservationId: 'credit-reservation-1',
      reservedCredits: 50n,
    }));
    expect(result.creditReservation.id).toBe('credit-reservation-1');
    expect(result.budgetReservations).toHaveLength(1);
  });

  it('releases the credit hold when budget admission fails', async () => {
    const deps = dependencies({
      reserveBudget: jest.fn(async () => {
        throw new Error('budget exhausted');
      }),
    });
    const service = createAiCommercialAdmissionService(deps);

    await expect(service.admit({
      tenantId: 'tenant-a',
      requestId: 'request-a',
      idempotencyKey: 'idem-a',
      reservedCredits: 50n,
    })).rejects.toMatchObject({
      code: AI_COMMERCIAL_ADMISSION_ERROR_CODES.budgetDenied,
    });

    expect(deps.releaseCredits).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      reservationId: 'credit-reservation-1',
      reason: 'budget_admission_failed',
    }));
  });

  it('fails closed and marks repair needed if admission compensation itself fails', async () => {
    const deps = dependencies({
      reserveBudget: jest.fn(async () => {
        throw new Error('budget exhausted');
      }),
      releaseCredits: jest.fn(async () => {
        throw new Error('database unavailable');
      }),
    });
    const service = createAiCommercialAdmissionService(deps);

    await expect(service.admit({
      tenantId: 'tenant-a',
      requestId: 'request-a',
      idempotencyKey: 'idem-a',
      reservedCredits: 50n,
    })).rejects.toMatchObject({
      code: AI_COMMERCIAL_ADMISSION_ERROR_CODES.compensationFailed,
    });
  });

  it('attempts both budget and credit release even when one release path fails', async () => {
    const deps = dependencies({
      releaseBudget: jest.fn(async () => {
        throw new Error('budget release failed');
      }),
    });
    const service = createAiCommercialAdmissionService(deps);
    const admission = await service.admit({
      tenantId: 'tenant-a',
      requestId: 'request-a',
      idempotencyKey: 'idem-a',
      reservedCredits: 50n,
    });

    await expect(service.release({
      admission,
      reason: 'provider_unavailable',
    })).rejects.toMatchObject({
      code: AI_COMMERCIAL_ADMISSION_ERROR_CODES.releaseFailed,
    });

    expect(deps.releaseBudget).toHaveBeenCalledTimes(1);
    expect(deps.releaseCredits).toHaveBeenCalledTimes(1);
  });
});
