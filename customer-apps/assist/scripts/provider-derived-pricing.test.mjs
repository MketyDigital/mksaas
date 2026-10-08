import assert from "node:assert/strict";
import test from "node:test";
import { deriveCustomerBaseRates } from "../src/billing/provider-derived-pricing.ts";

test("provider micro-dollar costs derive exact MKredit atom rates across token, image, and voice units", () => {
  const result = deriveCustomerBaseRates({
    provider_input_cost_micros_per_million: 5_000_000,
    provider_output_cost_micros_per_million: 30_000_000,
    provider_reasoning_cost_micros_per_million: 30_000_000,
    provider_image_cost_micros: 250_000,
    provider_audio_cost_micros_per_minute: 453,
  });

  assert.deepEqual({
    input: result.input_credits_per_million,
    output: result.output_credits_per_million,
    reasoning: result.reasoning_credits_per_million,
    image: result.image_credits,
    audio: result.audio_credits_per_minute,
  }, { input: 50_000_000, output: 300_000_000, reasoning: 300_000_000, image: 2_500_000, audio: 4_530 });
});

test("zero or missing provider prices never replace existing rates", () => {
  const result = deriveCustomerBaseRates({
    input_credits_per_million: 12_345,
    output_credits_per_million: 67_890,
    audio_credits_per_minute: 55,
    provider_input_cost_micros_per_million: 0,
    provider_output_cost_micros_per_million: null,
    provider_audio_cost_micros_per_minute: 0,
  });
  assert.deepEqual({
    input: result.input_credits_per_million,
    output: result.output_credits_per_million,
    audio: result.audio_credits_per_minute,
  }, { input: 12_345, output: 67_890, audio: 55 });
});

test("the existing customer percentage is applied to provider-derived rates at settlement", async () => {
  const { mediaUsageEconomics } = await import("../src/billing/media-economics.ts");
  const rate = deriveCustomerBaseRates({
    provider_input_cost_micros_per_million: 5_000_000,
    provider_output_cost_micros_per_million: 30_000_000,
    provider_image_cost_micros: 0,
    provider_audio_cost_micros_per_minute: 453,
  });
  const vision = mediaUsageEconomics({
    kind: "vision", inputUnits: 100_000, outputUnits: 0,
    rate: {
      inputCreditsPerMillion: rate.input_credits_per_million,
      outputCreditsPerMillion: rate.output_credits_per_million,
      imageCredits: rate.image_credits || 0,
      providerInputCostMicrosPerMillion: rate.provider_input_cost_micros_per_million,
      providerOutputCostMicrosPerMillion: rate.provider_output_cost_micros_per_million,
      providerImageCostMicros: rate.provider_image_cost_micros || 0,
    },
  }, 12_000);
  const speech = mediaUsageEconomics({
    kind: "speech", audioSeconds: 60,
    rate: {
      audioCreditsPerMinute: rate.audio_credits_per_minute,
      providerAudioCostMicrosPerMinute: rate.provider_audio_cost_micros_per_minute,
    },
  }, 12_000);

  assert.deepEqual(vision, { credits: 6_000_000, providerCostMicros: 500_000 });
  assert.deepEqual(speech, { credits: 5_436, providerCostMicros: 453 });
});
