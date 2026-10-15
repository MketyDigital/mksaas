const RATE_METRICS = [
  "inputCreditsPerMillion",
  "outputCreditsPerMillion",
  "imageCredits",
  "audioCreditsPerMinute",
] as const;

export const SIGNIFICANT_RATE_INCREASE_FACTOR = 10;

function maximumEnabledRate(targets: Array<Record<string, unknown>>, key: string): number {
  return targets.reduce((maximum, target) => Number(target.enabled ?? 1) === 1
    ? Math.max(maximum, Number(target[key] || 0)) : maximum, 0);
}

export function hasSignificantRateIncrease(
  previousTargets: Array<Record<string, unknown>>,
  nextTargets: Array<Record<string, unknown>>,
): boolean {
  return RATE_METRICS.some((metric) => {
    const previous = maximumEnabledRate(previousTargets, metric);
    const next = maximumEnabledRate(nextTargets, metric);
    return previous > 0 && next > previous * SIGNIFICANT_RATE_INCREASE_FACTOR;
  });
}
