export type AiCreditReservationStatus = 'held' | 'settled' | 'released';

export const AI_CREDIT_RESERVATION_ERROR_CODES = {
  invalidAmount: 'AI_CREDIT_RESERVATION_INVALID_AMOUNT',
  invalidIdempotencyKey: 'AI_CREDIT_RESERVATION_INVALID_IDEMPOTENCY_KEY',
  invalidExpiry: 'AI_CREDIT_RESERVATION_INVALID_EXPIRY',
  notFound: 'AI_CREDIT_RESERVATION_NOT_FOUND',
  insufficientCredits: 'AI_CREDIT_RESERVATION_INSUFFICIENT_CREDITS',
  idempotencyConflict: 'AI_CREDIT_RESERVATION_IDEMPOTENCY_CONFLICT',
  stateConflict: 'AI_CREDIT_RESERVATION_STATE_CONFLICT',
  settlementExceedsReservation: 'AI_CREDIT_RESERVATION_SETTLEMENT_EXCEEDS_RESERVATION',
} as const;

export type AiCreditReservationErrorCode =
  (typeof AI_CREDIT_RESERVATION_ERROR_CODES)[keyof typeof AI_CREDIT_RESERVATION_ERROR_CODES];

export class AiCreditReservationError extends Error {
  constructor(
    readonly code: AiCreditReservationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiCreditReservationError';
  }
}

export function assertReservationCredits(credits: bigint) {
  if (credits <= 0n) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.invalidAmount,
      'Reservation credits must be positive.',
    );
  }
}

export const AI_CREDIT_RESERVATION_DEFAULT_TTL_MS = 2 * 60 * 1000;
export const AI_CREDIT_RESERVATION_MAX_TTL_MS = 10 * 60 * 1000;

export function assertReservationIdempotencyKey(value: string) {
  if (!value || value.length > 160) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.invalidIdempotencyKey,
      'Reservation idempotency key must contain 1 to 160 characters.',
    );
  }
}

export function assertReservationExpiry(expiresAt: Date, now: Date) {
  const ttlMs = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > AI_CREDIT_RESERVATION_MAX_TTL_MS) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.invalidExpiry,
      'Reservation expiry must be in the future and no more than 10 minutes away.',
    );
  }
}

export function reservationOperationIdempotencyKey(
  fingerprint: string,
  operation: 'hold' | 'release' | 'usage',
) {
  return `aires:${fingerprint}:${operation}`;
}

export function planAiReservationSettlement(reservedCredits: bigint, actualCredits: bigint) {
  assertReservationCredits(reservedCredits);
  assertReservationCredits(actualCredits);
  if (actualCredits > reservedCredits) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.settlementExceedsReservation,
      'Actual credits exceed the reserved maximum.',
    );
  }

  return {
    holdLedgerDelta: -reservedCredits,
    releaseLedgerDelta: reservedCredits,
    usageLedgerDelta: -actualCredits,
    availableBalanceDeltaAfterHold: reservedCredits - actualCredits,
    lifetimeConsumedDelta: actualCredits,
    finalLedgerDelta: -actualCredits,
  };
}

export function planAiReservationRelease(reservedCredits: bigint) {
  assertReservationCredits(reservedCredits);
  return {
    holdLedgerDelta: -reservedCredits,
    releaseLedgerDelta: reservedCredits,
    availableBalanceDeltaAfterHold: reservedCredits,
    finalLedgerDelta: 0n,
  };
}

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createAiReservationFingerprint(input: {
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  requestId: string | null;
  reservedCredits: bigint;
  idempotencyKey: string;
}) {
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    projectId: input.projectId,
    apiKeyId: input.apiKeyId,
    requestId: input.requestId,
    reservedCredits: input.reservedCredits.toString(),
    idempotencyKey: input.idempotencyKey,
  });
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return toHex(new Uint8Array(digest));
}
