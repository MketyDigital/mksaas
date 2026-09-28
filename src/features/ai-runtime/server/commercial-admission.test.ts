import {
  AI_COMMERCIAL_ADMISSION_ERROR_CODES,
  createAiCommercialAdmissionService,
} from './commercial-admission';

const rate = {
  id: 'rate-1',
  modelId: 'model-1',
  version: 1,
  inputCreditsPerMillion: 100n,
  cachedInputCreditsPerMillion: 25n,
  outputCreditsPerMillion: 400n,
  minimumCreditsPerRequest: 1n,
  effectiveFrom: new Date('2026-09-28T00:00:00.000Z'),
  effectiveTo: null,
};

function createHarness(options: {
  budgetFailure?: boolean;
  inferenceEnabled?: boolean;
  authorizedWriteFailure?: boolean;
} = {}) {
  const calls: string[] = [];
  const deps = {
    getPolicy: async () => ({
      maxRequestBytes: 1_000_000,
      maxMessages: 128,
      maxTools: 64,
      maxOutputTokens: 32_768,
      reservationTtlSeconds: 120,
      prepaidOnly: true as const,
      customerInferenceEnabled: options.inferenceEnabled ?? true,
    }),
    markRequest: async (input: { status: string }) => {
      calls.push(`mark:${input.status}`);
      if (input.status === 'authorized' && options.authorizedWriteFailure) {
        throw new Error('request state write failed');
      }
    },
    resolveRate: async () => rate,
    reserveCredits: async () => {
      calls.push('credit:reserve');
      return {
        reservation: {
          id: 'credit-res-1',
          tenantId: 'tenant-a',
          projectId: 'project-a',
          apiKeyId: 'key-a',
          requestId: 'request-a',
          idempotencyKey: 'commercial-key',
          fingerprint: 'fingerprint',
          status: 'held' as const,
          reservedCredits: 5n,
          settledCredits: null,
          holdLedgerEntryId: 'ledger-hold',
          releaseLedgerEntryId: null,
          usageEventId: null,
          expiresAt: new Date('2026-09-28T12:02:00.000Z'),
          settledAt: null,
          releasedAt: null,
          releaseReason: null,
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
          updatedAt: new Date('2026-09-28T12:00:00.000Z'),
        },
        balance: {
          tenantId: 'tenant-a',
          availableCredits: 95n,
          lifetimeGranted: 100n,
          lifetimeConsumed: 0n,
        },
      };
    },
    reserveBudget: async () => {
      calls.push('budget:reserve');
      if (options.budgetFailure) throw new Error('budget exhausted');
      return {
        reservations: [{
          id: 'budget-res-1',
          tenantId: 'tenant-a',
          budgetId: 'budget-a',
          requestId: 'request-a',
          creditReservationId: 'credit-res-1',
          idempotencyKey: 'commercial-key',
          fingerprint: 'fingerprint',
          status: 'held' as const,
          reservedCredits: 5n,
          reservedRequests: 1n,
          settledCredits: null,
          settledRequests: null,
          expiresAt: new Date('2026-09-28T12:02:00.000Z'),
          settledAt: null,
          releasedAt: null,
          releaseReason: null,
          createdAt: new Date('2026-09-28T12:00:00.000Z'),
          updatedAt: new Date('2026-09-28T12:00:00.000Z'),
        }],
      };
    },
    releaseCredits: async () => {
      calls.push('credit:release');
      return {} as never;
    },
    releaseBudget: async () => {
      calls.push('budget:release');
      return {} as never;
    },
    settleCredits: async () => {
      calls.push('credit:settle');
      return {} as never;
    },
    settleBudget: async () => {
      calls.push('budget:settle');
      return {} as never;
    },
  };
  return { service: createAiCommercialAdmissionService(deps), calls };
}

const admissionInput = {
  tenantId: 'tenant-a',
  projectId: 'project-a',
  apiKeyId: 'key-a',
  requestId: 'request-a',
  requestIdempotencyKey: 'request-idem-a',
  requestFingerprint: 'request-fingerprint',
  modelId: 'model-1',
  inputTokenUpperBound: 1000n,
  maxOutputTokens: 1000n,
  now: new Date('2026-09-28T12:00:00.000Z'),
};

describe('AI commercial admission orchestrator', () => {
  it('requires policy, rate, credit hold, and all budgets before authorization', async () => {
    const { service, calls } = createHarness();

    const admission = await service.admit(admissionInput);

    expect(admission).toMatchObject({
      creditReservationId: 'credit-res-1',
      budgetReservationIds: ['budget-res-1'],
      rateCard: expect.objectContaining({ id: 'rate-1', version: 1 }),
    });
    expect(calls).toEqual([
      'credit:reserve',
      'budget:reserve',
      'mark:authorized',
    ]);
  });

  it('releases the credit hold when budget admission fails', async () => {
    const { service, calls } = createHarness({ budgetFailure: true });

    await expect(service.admit(admissionInput)).rejects.toThrow('budget exhausted');
    expect(calls).toEqual([
      'credit:reserve',
      'budget:reserve',
      'credit:release',
      'mark:admission_failed',
    ]);
  });


  it('releases budget and credit holds when a late authorization write fails', async () => {
    const { service, calls } = createHarness({ authorizedWriteFailure: true });

    await expect(service.admit(admissionInput)).rejects.toThrow('request state write failed');
    expect(calls).toEqual([
      'credit:reserve',
      'budget:reserve',
      'mark:authorized',
      'budget:release',
      'credit:release',
      'mark:admission_failed',
    ]);
  });

  it('fails before any hold when customer inference is disabled', async () => {
    const { service, calls } = createHarness({ inferenceEnabled: false });

    await expect(service.admit(admissionInput)).rejects.toMatchObject({
      code: AI_COMMERCIAL_ADMISSION_ERROR_CODES.policyDisabled,
    });
    expect(calls).toEqual([]);
  });

  it('can exercise admission in non-provider foundation mode without enabling inference', async () => {
    const { service, calls } = createHarness({ inferenceEnabled: false });

    await expect(service.admit({
      ...admissionInput,
      requireInferenceEnabled: false,
    })).resolves.toBeDefined();
    expect(calls).toContain('credit:reserve');
    expect(calls).toContain('budget:reserve');
  });

  it('releases budget first and credit second on provider failure', async () => {
    const { service, calls } = createHarness();
    const admission = await service.admit(admissionInput);
    calls.length = 0;

    await service.release(admission, 'provider_unavailable');

    expect(calls).toEqual([
      'budget:release',
      'credit:release',
      'mark:provider_unavailable',
    ]);
  });

  it('settles exact actual cost and refuses usage above the reservation', async () => {
    const { service, calls } = createHarness();
    const admission = await service.admit(admissionInput);
    calls.length = 0;

    await service.settle(admission, {
      inputTokens: 100n,
      outputTokens: 100n,
    });
    expect(calls).toEqual([
      'budget:settle',
      'credit:settle',
      'mark:completed',
    ]);

    await expect(service.settle({
      ...admission,
      reservedCredits: 1n,
    }, {
      inputTokens: 1_000_000n,
      outputTokens: 1_000_000n,
    })).rejects.toMatchObject({
      code: AI_COMMERCIAL_ADMISSION_ERROR_CODES.admissionFailed,
    });
  });
});
