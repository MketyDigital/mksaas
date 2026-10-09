import assert from "node:assert/strict";
import test from "node:test";
import { deriveCustomerBaseRates, deriveCustomerMediaBaseRates } from "../src/billing/provider-derived-pricing.ts";

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
  }, { input: 50_000_000, output: 300_000_000, reasoning: 300_000_000, image: 2_500_000, audio: 200_000 });
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
  }, { input: 20_000_000, output: 100_000_000, audio: 200_000 });
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

  assert.deepEqual(vision, { credits: 6_240_000, providerCostMicros: 500_000 });
  assert.deepEqual(speech, { credits: 240_000, providerCostMicros: 453 });
});


test("known Luna public price applies only to direct OpenAI routes", () => {
  const direct = deriveCustomerBaseRates({ provider: "openai", provider_model: "gpt-5.6-luna" });
  assert.deepEqual({
    inputCost: direct.provider_input_cost_micros_per_million,
    outputCost: direct.provider_output_cost_micros_per_million,
    input: direct.input_credits_per_million,
    output: direct.output_credits_per_million,
  }, { inputCost: 200_000, outputCost: 1_200_000, input: 20_000_000, output: 100_000_000 });
  const azure = deriveCustomerBaseRates({ provider: "azure-foundry", provider_model: "gpt-5.6-luna" });
  assert.equal(azure.provider_input_cost_micros_per_million, undefined);
  assert.equal(azure.provider_output_cost_micros_per_million, undefined);
  assert.equal(azure.input_credits_per_million, 20_000_000);
  assert.equal(azure.output_credits_per_million, 100_000_000);
});

test("Azure Luna receives a clearly labeled public offer estimate while customer minima remain authoritative", () => {
  const azure = deriveCustomerBaseRates({ provider: "azure-foundry", provider_model: "gpt-6-luna-1" });
  assert.equal(azure.provider_input_cost_micros_per_million, 100_000);
  assert.equal(azure.provider_output_cost_micros_per_million, 500_000);
  assert.equal(azure.provider_pricing_source, "public_offer_estimate");
  assert.equal(azure.provider_pricing_tier, "Microsoft Foundry Global Standard, short context; public offer estimate");
  assert.equal(azure.provider_pricing_verified_at, "2026-10-09");
  assert.match(azure.provider_pricing_source_url, /^https:\/\/azure\.microsoft\.com\//);
  assert.equal(azure.input_credits_per_million, 20_000_000);
  assert.equal(azure.output_credits_per_million, 100_000_000);
});

test("vision ignores legacy image surcharge when image provider cost is unknown", () => {
  const result = deriveCustomerBaseRates({
    provider_input_cost_micros_per_million: 5_000_000,
    provider_output_cost_micros_per_million: 30_000_000,
    provider_image_cost_micros: 0,
    image_credits: 3_000,
  });
  assert.equal(result.image_credits, 200_000);
});


test("unknown image and voice prices use a 20 MKredit per-unit baseline", () => {
  const image = deriveCustomerMediaBaseRates({ image_credits: 0, provider_image_cost_micros: 0 }, "vision");
  const voice = deriveCustomerMediaBaseRates({ audio_credits_per_minute: 0, provider_audio_cost_micros_per_minute: 0 }, "speech");
  assert.equal(image.image_credits, 200_000);
  assert.equal(voice.audio_credits_per_minute, 200_000);
});

test("known provider media prices below the floor remain at the fallback baseline", () => {
  const image = deriveCustomerMediaBaseRates({ provider_image_cost_micros: 2 }, "vision");
  const voice = deriveCustomerMediaBaseRates({ provider_audio_cost_micros_per_minute: 453 }, "speech");
  assert.equal(image.image_credits, 200_000);
  assert.equal(voice.audio_credits_per_minute, 200_000);
});
