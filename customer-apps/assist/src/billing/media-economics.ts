import { deriveCustomerBaseRates } from "./provider-derived-pricing.ts";

export function mediaUsageEconomics(usage: any, multiplierBps: number) {
  const rate = deriveCustomerBaseRates(usage?.rate || {});
  if (usage?.kind === "speech") {
    const customerRate = Math.ceil(Number(rate.audioCreditsPerMinute || 0) * multiplierBps / 10000);
    const credits = Math.max(1, Math.ceil((Number(usage.audioSeconds || 0) / 60) * customerRate));
    const providerCostMicros = Math.max(0, Math.ceil(
      (Number(usage.audioSeconds || 0) / 60) * Number(rate.providerAudioCostMicrosPerMinute || 0),
    ));
    return { credits, providerCostMicros };
  }
  const inputRate = Math.ceil(Number(rate.inputCreditsPerMillion || 0) * multiplierBps / 10000);
  const outputRate = Math.ceil(Number(rate.outputCreditsPerMillion || 0) * multiplierBps / 10000);
  const fixedImageCredits = Math.ceil(Number(rate.imageCredits || 0) * multiplierBps / 10000);
  const credits = Math.max(1, fixedImageCredits + Math.ceil(
    (Number(usage.inputUnits || 0) * inputRate + Number(usage.outputUnits || 0) * outputRate) / 1_000_000,
  ));
  const providerCostMicros = Math.max(0,
    Number(rate.providerImageCostMicros || 0)
    + Math.ceil((
      Number(usage.inputUnits || 0) * Number(rate.providerInputCostMicrosPerMillion || 0)
      + Number(usage.outputUnits || 0) * Number(rate.providerOutputCostMicrosPerMillion || 0)
    ) / 1_000_000),
  );
  return { credits, providerCostMicros };
}
