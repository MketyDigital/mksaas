export function ceilDiv(numerator: number, denominator: number) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator <= 0) {
    throw new Error("integer_metering_required");
  }
  return Math.floor((numerator + denominator - 1) / denominator);
}

export function calculateInferenceCredits(input: {
  inputUnits: number;
  outputUnits: number;
  inputCreditsPerMillion: number;
  outputCreditsPerMillion: number;
  imageCount?: number;
  imageCredits?: number;
  audioSeconds?: number;
  audioCreditsPerMinute?: number;
}) {
  const inputCredits = ceilDiv(input.inputUnits * input.inputCreditsPerMillion, 1_000_000);
  const outputCredits = ceilDiv(input.outputUnits * input.outputCreditsPerMillion, 1_000_000);
  const images = (input.imageCount ?? 0) * (input.imageCredits ?? 0);
  const audio = input.audioSeconds
    ? ceilDiv(input.audioSeconds * (input.audioCreditsPerMinute ?? 0), 60)
    : 0;
  return Math.max(1, inputCredits + outputCredits + images + audio);
}

export function customerUsageProjection(input: {
  monthlyFeeMinor: number;
  setupFeeMinor?: number | null;
  creditsAvailable: number;
  creditsUsed: number;
}) {
  return {
    monthlyFeeMinor: input.monthlyFeeMinor,
    ...(input.setupFeeMinor ? { setupFeeMinor: input.setupFeeMinor } : {}),
    creditsAvailable: input.creditsAvailable,
    creditsUsed: input.creditsUsed,
  };
}
