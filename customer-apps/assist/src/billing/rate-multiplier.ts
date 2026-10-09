export const MIN_RATE_MULTIPLIER_BPS = 100;
export const MAX_RATE_MULTIPLIER_BPS = 100_000;
export const DEFAULT_RATE_MULTIPLIER_BPS = 10_000;

export function normalizeRateMultiplierBps(value: unknown, fallback = DEFAULT_RATE_MULTIPLIER_BPS): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < MIN_RATE_MULTIPLIER_BPS || parsed > MAX_RATE_MULTIPLIER_BPS) {
    return fallback;
  }
  return Math.round(parsed);
}
