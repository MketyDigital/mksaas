import { deriveCustomerMediaBaseRates } from "./provider-derived-pricing.ts";
import { normalizeRateMultiplierBps } from "./rate-multiplier.ts";

export function mediaUsageEconomics(usage: any, textMultiplierBps: number, mediaMultiplierBps = textMultiplierBps) {
  const rate = deriveCustomerMediaBaseRates(usage?.rate || {}, usage?.kind === "speech" ? "speech" : "vision");
  if (usage?.kind === "speech") {
    const customerRate = Math.ceil(Number(rate.audioCreditsPerMinute || 0) * normalizeRateMultiplierBps(mediaMultiplierBps) / 10000);
    const credits = Math.max(1, Math.ceil((Number(usage.audioSeconds || 0) / 60) * customerRate));
    const providerCostMicros = Math.max(0, Math.ceil(
      (Number(usage.audioSeconds || 0) / 60) * Number(rate.providerAudioCostMicrosPerMinute || 0),
    ));
    return { credits, providerCostMicros };
  }
  const inputRate = Math.ceil(Number(rate.inputCreditsPerMillion || 0) * normalizeRateMultiplierBps(textMultiplierBps) / 10000);
  const outputRate = Math.ceil(Number(rate.outputCreditsPerMillion || 0) * normalizeRateMultiplierBps(textMultiplierBps) / 10000);
  const imageCount = Math.max(1, Math.ceil(Number(usage.imageCount || 1)));
  const imageRate = Math.ceil(Number(rate.imageCredits || 0) * normalizeRateMultiplierBps(mediaMultiplierBps) / 10000);
  const fixedImageCredits = imageRate * imageCount;
  const credits = Math.max(1, fixedImageCredits + Math.ceil(
    (Number(usage.inputUnits || 0) * inputRate + Number(usage.outputUnits || 0) * outputRate) / 1_000_000,
  ));
  const providerCostMicros = Math.max(0,
    Math.ceil(Number(rate.providerImageCostMicros || 0) * imageCount)
    + Math.ceil((
      Number(usage.inputUnits || 0) * Number(rate.providerInputCostMicrosPerMillion || 0)
      + Number(usage.outputUnits || 0) * Number(rate.providerOutputCostMicrosPerMillion || 0)
    ) / 1_000_000),
  );
  return { credits, providerCostMicros };
}
