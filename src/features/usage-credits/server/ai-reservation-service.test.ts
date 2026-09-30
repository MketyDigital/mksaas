import {
  AI_CREDIT_RESERVATION_ERROR_CODES,
} from './ai-reservation-engine';
import {
  createAiCreditReservationService,
  type ReserveAiCreditsInput,
} from './ai-reservation-service';
import type {
  AiCreditReservationSource,
  AiCreditReservationTransaction,
  NewStoredAiCreditReservation,
  StoredAiCreditReservation,
} from './ai-reservation-source';
import type {
  CreditLedgerRecord,
  NewCreditLedgerRecord,
  NewStoredUsageRecord,
  StoredUsageRecord,
} from './source';
import type { CreditBalance } from '../types';

class FakeAiReservationSource implements AiCreditReservationSource {
  accounts = new Map<string, CreditBalance>();
  reservations: StoredAiCreditReservation[] = [];
  ledger: CreditLedgerRecord[] = [];
  usage: StoredUsageRecord[] = [];
  validScopes = new Set<string>(['tenant-a:project-a:key-a:request-a']);
  private queue = Promise.resolve();
  private sequence = 0;

  seedCredits(tenantId: string, credits: bigint) {
    this.accounts.set(tenantId, {
      tenantId,
      availableCredits: credits,
      lifetimeGranted: credits,
      lifetimeConsumed: 0n,
    });
  }

  private scopeKey(tenantId: string, projectId: string | null, apiKeyId: string | null, requestId: string | null) {
    return `${tenantId}:${projectId ?? ''}:${apiKeyId ?? ''}:${requestId ?? ''}`;
  }

  async transaction<T>(work: (tx: AiCreditReservationTransaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const accountSnapshot = new Map(this.accounts);
    const reservationsSnapshot = this.reservations.map((item) => ({ ...item }));
    const ledgerSnapshot = this.ledger.map((item) => ({ ...item }));
    const usageSnapshot = this.usage.map((item) => ({ ...item }));

    const tx: AiCreditReservationTransaction = {
      findReservationByIdempotency: async (tenantId, idempotencyKey) =>
        this.reservations.find(
          (item) => item.tenantId === tenantId && item.idempotencyKey === idempotencyKey,
        ) ?? null,

      getReservation: async (tenantId, reservationId) =>
        this.reservations.find(
          (item) => item.tenantId === tenantId && item.id === reservationId,
        ) ?? null,

      validateOwnedScope: async (tenantId, scope) => {
        if (!scope.projectId && !scope.apiKeyId && !scope.requestId) return true;
        return this.validScopes.has(
          this.scopeKey(tenantId, scope.projectId, scope.apiKeyId, scope.requestId),
        );
      },

      getCreditBalance: async (tenantId) => this.accounts.get(tenantId) ?? null,

      applyReservationHold: async (tenantId, credits) => {
        const current = this.accounts.get(tenantId);
        if (!current || current.availableCredits < credits) return null;
        const next = { ...current, availableCredits: current.availableCredits - credits };
        this.accounts.set(tenantId, next);
        return next;
      },

      applyReservationSettlement: async (tenantId, reservedCredits, actualCredits) => {
        const current = this.accounts.get(tenantId);
        if (!current) return null;
        const next = {
          ...current,
          availableCredits: current.availableCredits + reservedCredits - actualCredits,
          lifetimeConsumed: current.lifetimeConsumed + actualCredits,
        };
        this.accounts.set(tenantId, next);
        return next;
      },

      applyReservationRelease: async (tenantId, reservedCredits) => {
        const current = this.accounts.get(tenantId);
        if (!current) return null;
        const next = { ...current, availableCredits: current.availableCredits + reservedCredits };
        this.accounts.set(tenantId, next);
        return next;
      },

      insertReservation: async (input: NewStoredAiCreditReservation) => {
        const now = new Date();
        const item: StoredAiCreditReservation = {
          id: `reservation-${++this.sequence}`,
          ...input,
          settledCredits: input.settledCredits ?? null,
          releaseLedgerEntryId: input.releaseLedgerEntryId ?? null,
          usageEventId: input.usageEventId ?? null,
          settledAt: input.settledAt ?? null,
          releasedAt: input.releasedAt ?? null,
          releaseReason: input.releaseReason ?? null,
          createdAt: now,
          updatedAt: now,
        };
        this.reservations.push(item);
        return item;
      },

      claimSettlement: async (tenantId, reservationId, actualCredits, settledAt) => {
        const item = this.reservations.find(
          (candidate) =>
            candidate.tenantId === tenantId &&
            candidate.id === reservationId &&
            candidate.status === 'held',
        );
        if (!item) return null;
        item.status = 'settled';
        item.settledCredits = actualCredits;
        item.settledAt = settledAt;
        item.updatedAt = settledAt;
        return { ...item };
      },

      claimRelease: async (tenantId, reservationId, reason, releasedAt) => {
        const item = this.reservations.find(
          (candidate) =>
            candidate.tenantId === tenantId &&
            candidate.id === reservationId &&
            candidate.status === 'held',
        );
        if (!item) return null;
        item.status = 'released';
        item.releaseReason = reason;
        item.releasedAt = releasedAt;
        item.updatedAt = releasedAt;
        return { ...item };
      },

      finalizeSettlementLinks: async (input) => {
        const item = this.reservations.find(
          (candidate) =>
            candidate.tenantId === input.tenantId &&
            candidate.id === input.reservationId &&
            candidate.status === 'settled',
        );
        if (!item) throw new Error('missing settlement');
        item.releaseLedgerEntryId = input.releaseLedgerEntryId;
        item.usageEventId = input.usageEventId;
        return { ...item };
      },

      finalizeReleaseLink: async (input) => {
        const item = this.reservations.find(
          (candidate) =>
            candidate.tenantId === input.tenantId &&
            candidate.id === input.reservationId &&
            candidate.status === 'released',
        );
        if (!item) throw new Error('missing release');
        item.releaseLedgerEntryId = input.releaseLedgerEntryId;
        return { ...item };
      },

      insertUsage: async (input: NewStoredUsageRecord) => {
        const item: StoredUsageRecord = { ...input, id: `usage-${++this.sequence}` };
        this.usage.push(item);
        return item;
      },

      insertLedger: async (input: NewCreditLedgerRecord) => {
        const item: CreditLedgerRecord = { ...input, id: `ledger-${++this.sequence}` };
        this.ledger.push(item);
        return item;
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.accounts = accountSnapshot;
      this.reservations = reservationsSnapshot;
      this.ledger = ledgerSnapshot;
      this.usage = usageSnapshot;
      throw error;
    } finally {
      release();
    }
  }
}

const reserveInput = (overrides: Partial<ReserveAiCreditsInput> = {}): ReserveAiCreditsInput => ({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  apiKeyId: 'key-a',
  requestId: 'request-a',
  reservedCredits: 80n,
  idempotencyKey: 'ai-request-1',
  now: new Date('2026-09-28T12:00:00.000Z'),
  expiresAt: new Date('2026-09-28T12:02:00.000Z'),
  ...overrides,
});

describe('AI credit reservation service', () => {
  it('holds credits without increasing lifetime consumption', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);

    const result = await service.reserve(reserveInput());

    expect(result.reservation).toMatchObject({ status: 'held', reservedCredits: 80n });
    expect(result.balance).toMatchObject({
      availableCredits: 20n,
      lifetimeConsumed: 0n,
    });
    expect(source.ledger).toHaveLength(1);
    expect(source.ledger[0]).toMatchObject({
      entryType: 'reservation_hold',
      delta: -80n,
    });
  });

  it('replays the same reservation without a second hold and rejects conflicting reuse', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);

    const first = await service.reserve(reserveInput());
    const replay = await service.reserve(reserveInput());

    expect(replay.reservation.id).toBe(first.reservation.id);
    expect(replay.balance.availableCredits).toBe(20n);
    expect(source.ledger).toHaveLength(1);

    await expect(
      service.reserve(reserveInput({ reservedCredits: 81n })),
    ).rejects.toMatchObject({
      code: AI_CREDIT_RESERVATION_ERROR_CODES.idempotencyConflict,
    });
  });

  it('prevents concurrent reservations from overspending one balance', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);

    const results = await Promise.allSettled([
      service.reserve(reserveInput({ idempotencyKey: 'request-a', reservedCredits: 70n })),
      service.reserve(reserveInput({ idempotencyKey: 'request-b', reservedCredits: 70n })),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(source.accounts.get('tenant-a')).toMatchObject({
      availableCredits: 30n,
      lifetimeConsumed: 0n,
    });
  });

  it('settles to exact actual usage and preserves net ledger accounting', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);
    const held = await service.reserve(reserveInput({ reservedCredits: 100n }));

    const result = await service.settle({
      tenantId: 'tenant-a',
      reservationId: held.reservation.id,
      actualCredits: 37n,
      occurredAt: new Date('2026-09-28T12:00:30.000Z'),
    });

    expect(result.reservation).toMatchObject({ status: 'settled', settledCredits: 37n });
    expect(result.balance).toMatchObject({
      availableCredits: 63n,
      lifetimeConsumed: 37n,
    });
    expect(source.usage).toHaveLength(1);
    expect(source.usage[0]).toMatchObject({
      meterKey: 'ai.request',
      quantity: 1n,
      creditsCharged: 37n,
    });
    expect(source.ledger.reduce((sum, item) => sum + item.delta, 0n)).toBe(-37n);
  });

  it('releases provider-failure holds completely without usage consumption', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);
    const held = await service.reserve(reserveInput());

    const result = await service.release({
      tenantId: 'tenant-a',
      reservationId: held.reservation.id,
      reason: 'provider_failure',
    });

    expect(result.reservation.status).toBe('released');
    expect(result.balance).toMatchObject({
      availableCredits: 100n,
      lifetimeConsumed: 0n,
    });
    expect(source.usage).toHaveLength(0);
    expect(source.ledger.reduce((sum, item) => sum + item.delta, 0n)).toBe(0n);
  });

  it('allows only one winner in a settle-versus-release race', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);
    const held = await service.reserve(reserveInput());

    const results = await Promise.allSettled([
      service.settle({
        tenantId: 'tenant-a',
        reservationId: held.reservation.id,
        actualCredits: 30n,
      }),
      service.release({
        tenantId: 'tenant-a',
        reservationId: held.reservation.id,
        reason: 'provider_failure',
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(['settled', 'released']).toContain(source.reservations[0]?.status);
  });

  it('rejects settlement above the reservation and rolls back the terminal claim', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);
    const held = await service.reserve(reserveInput({ reservedCredits: 40n }));

    await expect(
      service.settle({
        tenantId: 'tenant-a',
        reservationId: held.reservation.id,
        actualCredits: 41n,
      }),
    ).rejects.toMatchObject({
      code: AI_CREDIT_RESERVATION_ERROR_CODES.settlementExceedsReservation,
    });

    expect(source.reservations[0]).toMatchObject({ status: 'held', settledCredits: null });
    expect(source.accounts.get('tenant-a')?.availableCredits).toBe(60n);
  });

  it('rejects references outside the tenant before touching the balance', async () => {
    const source = new FakeAiReservationSource();
    source.seedCredits('tenant-a', 100n);
    const service = createAiCreditReservationService(source);

    await expect(
      service.reserve(reserveInput({ projectId: 'foreign-project' })),
    ).rejects.toMatchObject({
      code: AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
    });

    expect(source.accounts.get('tenant-a')?.availableCredits).toBe(100n);
    expect(source.ledger).toHaveLength(0);
  });
});
