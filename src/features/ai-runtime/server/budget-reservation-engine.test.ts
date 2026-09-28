import {
  AI_BUDGET_RESERVATION_ERROR_CODES,
  createAiBudgetReservationFingerprint,
  assertBudgetReservationExpiry,
  assertBudgetSettlementWithinReservation,
} from './budget-reservation-engine';

describe('AI budget reservation engine', () => {
  it('rejects settlement above reserved credits or requests', () => {
    expect(() =>
      assertBudgetSettlementWithinReservation({
        reservedCredits: 10n,
        reservedRequests: 1n,
        actualCredits: 11n,
        actualRequests: 1n,
      }),
    ).toThrow(expect.objectContaining({
      code: AI_BUDGET_RESERVATION_ERROR_CODES.settlementExceedsReservation,
    }));

    expect(() =>
      assertBudgetSettlementWithinReservation({
        reservedCredits: 10n,
        reservedRequests: 1n,
        actualCredits: 10n,
        actualRequests: 2n,
      }),
    ).toThrow(expect.objectContaining({
      code: AI_BUDGET_RESERVATION_ERROR_CODES.settlementExceedsReservation,
    }));
  });

  it('bounds reservation expiry', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    expect(() => assertBudgetReservationExpiry(
      new Date('2026-09-28T12:02:00.000Z'),
      now,
    )).not.toThrow();
    expect(() => assertBudgetReservationExpiry(
      new Date('2026-09-28T12:11:00.000Z'),
      now,
    )).toThrow(expect.objectContaining({
      code: AI_BUDGET_RESERVATION_ERROR_CODES.invalidExpiry,
    }));
  });

  it('fingerprints scope, commercial amount, linkage, and idempotency', async () => {
    const base = {
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      requestId: 'request-a',
      creditReservationId: 'credit-a',
      reservedCredits: 25n,
      reservedRequests: 1n,
      idempotencyKey: 'idem-a',
    };

    const fingerprint = await createAiBudgetReservationFingerprint(base);
    await expect(createAiBudgetReservationFingerprint(base)).resolves.toBe(fingerprint);
    await expect(createAiBudgetReservationFingerprint({
      ...base,
      idempotencyKey: 'idem-b',
    })).resolves.not.toBe(fingerprint);
    await expect(createAiBudgetReservationFingerprint({
      ...base,
      reservedCredits: 26n,
    })).resolves.not.toBe(fingerprint);
  });
});
