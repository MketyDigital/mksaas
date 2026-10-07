import assert from "node:assert/strict";
import test from "node:test";
import { mediaUsageEconomics } from "../src/billing/media-economics.ts";

test("image input and output tokens charge the configured customer rates and track provider cost", () => {
  const result = mediaUsageEconomics({
    kind: "vision",
    inputUnits: 100_000,
    outputUnits: 2_000,
    rate: {
      inputCreditsPerMillion: 40_000_000,
      outputCreditsPerMillion: 200_000_000,
      imageCredits: 0,
      providerInputCostMicrosPerMillion: 4_000_000,
      providerOutputCostMicrosPerMillion: 20_000_000,
      providerImageCostMicros: 0,
    },
  }, 12_000);

  assert.deepEqual(result, { credits: 5_280_000, providerCostMicros: 440_000 });
});

test("vision flat fees add to token charges and known per-image provider cost", () => {
  const result = mediaUsageEconomics({
    kind: "vision",
    inputUnits: 1_000_000,
    outputUnits: 0,
    rate: {
      inputCreditsPerMillion: 1_000_000,
      outputCreditsPerMillion: 0,
      imageCredits: 20,
      providerInputCostMicrosPerMillion: 100_000,
      providerOutputCostMicrosPerMillion: 0,
      providerImageCostMicros: 2,
    },
  }, 12_000);

  assert.deepEqual(result, { credits: 1_200_024, providerCostMicros: 100_002 });
});
