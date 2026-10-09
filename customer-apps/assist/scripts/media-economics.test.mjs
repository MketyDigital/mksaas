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

  assert.deepEqual(result, { credits: 5_520_000, providerCostMicros: 440_000 });
});

test("vision token metering adds the configured fallback when provider image pricing is missing", () => {
  const result = mediaUsageEconomics({
    kind: "vision",
    inputUnits: 1_000_000,
    outputUnits: 0,
    rate: {
      inputCreditsPerMillion: 1_000_000,
      outputCreditsPerMillion: 0,
      imageCredits: 300,
      providerInputCostMicrosPerMillion: 100_000,
      providerOutputCostMicrosPerMillion: 0,
      providerImageCostMicros: 0,
    },
  }, 12_000);

  assert.deepEqual(result, { credits: 24_240_000, providerCostMicros: 100_000 });
});

test("Whisper provider rate replaces a stale customer rate before the multiplier", () => {
  const result = mediaUsageEconomics({
    kind: "speech", audioSeconds: 60,
    rate: { audioCreditsPerMinute: 100_000, providerAudioCostMicrosPerMinute: 453 },
  }, 12_000);
  assert.deepEqual(result, { credits: 240_000, providerCostMicros: 453 });
});


test("two provider-unpriced images use 20 MKredit each with the media multiplier", () => {
  const result = mediaUsageEconomics({
    kind: "vision", imageCount: 2, inputUnits: 0, outputUnits: 0,
    rate: { imageCredits: 0, providerImageCostMicros: 0 },
  }, 12_000);
  assert.deepEqual(result, { credits: 480_000, providerCostMicros: 0 });
});

test("unpriced voice uses 20 MKredit per minute and prorates elapsed audio", () => {
  const result = mediaUsageEconomics({
    kind: "speech", audioSeconds: 30,
    rate: { audioCreditsPerMinute: 0, providerAudioCostMicrosPerMinute: 0 },
  }, 12_000);
  assert.deepEqual(result, { credits: 120_000, providerCostMicros: 0 });
});
