import {
  AI_CREDIT_RESERVATION_ERROR_CODES,
  createAiReservationFingerprint,
  planAiReservationRelease,
  planAiReservationSettlement,
} from './ai-reservation-engine';

describe('AI credit reservation accounting engine', () => {
  it('settles a hold to the exact actual charge without double-debiting', () => {
    const plan = planAiReservationSettlement(100n, 37n);
    expect(plan).toEqual({
      holdLedgerDelta: -100n,
      releaseLedgerDelta: 100n,
      usageLedgerDelta: -37n,
      availableBalanceDeltaAfterHold: 63n,
      lifetimeConsumedDelta: 37n,
      finalLedgerDelta: -37n,
    });
    expect(plan.holdLedgerDelta + plan.releaseLedgerDelta + plan.usageLedgerDelta)
      .toBe(plan.finalLedgerDelta);
  });

  it('fully reverses a failed provider hold without consumption', () => {
    const plan = planAiReservationRelease(100n);
    expect(plan.holdLedgerDelta + plan.releaseLedgerDelta).toBe(0n);
    expect(plan.availableBalanceDeltaAfterHold).toBe(100n);
  });

  it('rejects settlement above the reserved maximum', () => {
    expect(() => planAiReservationSettlement(10n, 11n)).toThrow(
      expect.objectContaining({
        code: AI_CREDIT_RESERVATION_ERROR_CODES.settlementExceedsReservation,
      }),
    );
  });

  it('fingerprints commercial scope and amount deterministically', async () => {
    const base = {
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      requestId: 'request-a',
      reservedCredits: 25n,
    };
    await expect(createAiReservationFingerprint(base)).resolves
      .toBe(await createAiReservationFingerprint(base));
    await expect(createAiReservationFingerprint({ ...base, reservedCredits: 26n })).resolves
      .not.toBe(await createAiReservationFingerprint(base));
    await expect(createAiReservationFingerprint({ ...base, tenantId: 'tenant-b' })).resolves
      .not.toBe(await createAiReservationFingerprint(base));
  });
});
