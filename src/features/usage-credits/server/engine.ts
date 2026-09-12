import { isUsageMeterKey, type UsageMeterKey } from '../meter-keys';
import { USAGE_CREDIT_ERROR_CODES, UsageCreditError } from '../types';

export function assertPositiveAmount(value: bigint): void {
  if (value <= 0n) {
    throw new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.invalidAmount,
      'Credit and usage amounts must be positive.',
    );
  }
}

export function assertKnownMeter(value: string): asserts value is UsageMeterKey {
  if (!isUsageMeterKey(value)) {
    throw new UsageCreditError(USAGE_CREDIT_ERROR_CODES.unknownMeter, 'Unknown usage meter.');
  }
}

export function assertSufficientCredits(available: bigint, requested: bigint): void {
  assertPositiveAmount(requested);

  if (available < requested) {
    throw new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.insufficientCredits,
      'Insufficient credits.',
    );
  }
}

interface ExistingIdempotencyResult {
  fingerprint: string;
  resultId: string;
}

export function resolveIdempotency(input: {
  existing: ExistingIdempotencyResult | null;
  fingerprint: string;
}): { kind: 'proceed' } | { kind: 'replay'; resultId: string } {
  if (!input.existing) {
    return { kind: 'proceed' };
  }

  if (input.existing.fingerprint !== input.fingerprint) {
    throw new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.idempotencyConflict,
      'Idempotency key was already used for a different operation.',
    );
  }

  return { kind: 'replay', resultId: input.existing.resultId };
}
