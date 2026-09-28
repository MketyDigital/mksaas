export const AI_BUDGET_RESERVATION_ERROR_CODES = {
  invalidAmount: 'AI_BUDGET_RESERVATION_INVALID_AMOUNT',
  invalidIdempotencyKey: 'AI_BUDGET_RESERVATION_INVALID_IDEMPOTENCY_KEY',
  invalidExpiry: 'AI_BUDGET_RESERVATION_INVALID_EXPIRY',
  budgetMissing: 'AI_BUDGET_RESERVATION_BUDGET_MISSING',
  budgetExhausted: 'AI_BUDGET_RESERVATION_BUDGET_EXHAUSTED',
  idempotencyConflict: 'AI_BUDGET_RESERVATION_IDEMPOTENCY_CONFLICT',
  stateConflict: 'AI_BUDGET_RESERVATION_STATE_CONFLICT',
  settlementExceedsReservation: 'AI_BUDGET_RESERVATION_SETTLEMENT_EXCEEDS_RESERVATION',
} as const;

export type AiBudgetReservationErrorCode =
  (typeof AI_BUDGET_RESERVATION_ERROR_CODES)[keyof typeof AI_BUDGET_RESERVATION_ERROR_CODES];

export class AiBudgetReservationError extends Error {
  constructor(
    readonly code: AiBudgetReservationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiBudgetReservationError';
  }
}

export const AI_BUDGET_RESERVATION_DEFAULT_TTL_MS = 2 * 60 * 1000;
export const AI_BUDGET_RESERVATION_MAX_TTL_MS = 10 * 60 * 1000;

export function assertBudgetReservationAmount(credits: bigint, requests: bigint) {
  if (credits <= 0n || requests <= 0n) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.invalidAmount,
      'Budget reservation credits and requests must be positive.',
    );
  }
}

export function assertBudgetReservationIdempotencyKey(value: string) {
  if (!value || value.length > 160) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.invalidIdempotencyKey,
      'Budget reservation idempotency key must contain 1 to 160 characters.',
    );
  }
}

export function assertBudgetReservationExpiry(expiresAt: Date, now: Date) {
  const ttlMs = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > AI_BUDGET_RESERVATION_MAX_TTL_MS) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.invalidExpiry,
      'Budget reservation expiry must be in the future and no more than 10 minutes away.',
    );
  }
}

export function assertBudgetSettlementWithinReservation(input: {
  reservedCredits: bigint;
  reservedRequests: bigint;
  actualCredits: bigint;
  actualRequests: bigint;
}) {
  assertBudgetReservationAmount(input.reservedCredits, input.reservedRequests);
  assertBudgetReservationAmount(input.actualCredits, input.actualRequests);
  if (
    input.actualCredits > input.reservedCredits ||
    input.actualRequests > input.reservedRequests
  ) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.settlementExceedsReservation,
      'Budget settlement exceeds the reserved maximum.',
    );
  }
}

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createAiBudgetReservationFingerprint(input: {
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  requestId: string | null;
  creditReservationId: string | null;
  reservedCredits: bigint;
  reservedRequests: bigint;
  idempotencyKey: string;
}) {
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    projectId: input.projectId,
    apiKeyId: input.apiKeyId,
    requestId: input.requestId,
    creditReservationId: input.creditReservationId,
    reservedCredits: input.reservedCredits.toString(),
    reservedRequests: input.reservedRequests.toString(),
    idempotencyKey: input.idempotencyKey,
  });
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return toHex(new Uint8Array(digest));
}
