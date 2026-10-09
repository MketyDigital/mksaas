import assert from "node:assert/strict";
import test from "node:test";
import { reasoningCapabilities, providerReasoningOptions } from "../src/providers/reasoning.ts";
import { routeTargetMediaSupported } from "../src/providers/route-readiness.ts";
import { deriveCustomerBaseRates, deriveCustomerMediaBaseRates } from "../src/billing/provider-derived-pricing.ts";
import { mediaUsageEconomics } from "../src/billing/media-economics.ts";
import { normalizeRateMultiplierBps } from "../src/billing/rate-multiplier.ts";
import { azureFoundryInputItems } from "../src/providers/azure-foundry.ts";

test("Azure GPT-6 Luna preserves Sol reasoning tiers and encodes maximum effort", () => {
  assert.deepEqual(reasoningCapabilities("azure-foundry", "gpt-6-luna-1"), ["standard", "high", "maximum"]);
  assert.deepEqual(providerReasoningOptions("azure-foundry", "gpt-6-luna-1", "maximum"), { reasoning: { effort: "xhigh" } });
});

test("Azure GPT-6 Luna remains eligible for image and tool capable Assist routes", () => {
  assert.equal(routeTargetMediaSupported({ provider: "azure-foundry", provider_model: "gpt-6-luna-1" }, "mkety-media-vision"), true);
});

test("Azure Responses adapter preserves image payload parts for Luna vision requests", () => {
  const imageParts = [
    { type: "input_text", text: "Describe this" },
    { type: "input_image", image_url: "data:image/png;base64,AA==", detail: "low" },
  ];
  assert.deepEqual(azureFoundryInputItems([
    { role: "system", content: "system text" },
    { role: "user", content: imageParts },
  ]), [{ role: "user", content: imageParts }]);
});

test("all usage modalities use approved floors when provider rates are missing or lower", () => {
  const unknown = deriveCustomerBaseRates({});
  assert.equal(unknown.input_credits_per_million, 20_000_000);
  assert.equal(unknown.output_credits_per_million, 100_000_000);
  assert.equal(unknown.reasoning_credits_per_million, 100_000_000);
  assert.equal(unknown.image_credits, 200_000);
  assert.equal(unknown.audio_credits_per_minute, 200_000);

  const whisper = deriveCustomerMediaBaseRates({ provider_audio_cost_micros_per_minute: 453 }, "speech");
  assert.equal(whisper.audio_credits_per_minute, 200_000);
});

test("Azure uses its own published offer and does not substitute OpenAI direct prices", () => {
  const azureLuna = deriveCustomerBaseRates({ provider: "azure-foundry", provider_model: "gpt-6-luna-1" });
  assert.equal(azureLuna.provider_input_cost_micros_per_million, 100_000);
  assert.equal(azureLuna.provider_output_cost_micros_per_million, 500_000);
  assert.equal(azureLuna.provider_pricing_source, "public_offer_estimate");
  const azureUnknown = deriveCustomerBaseRates({ provider: "azure-foundry", provider_model: "gpt-5.6-luna" });
  assert.equal(azureUnknown.provider_input_cost_micros_per_million, undefined);
  assert.equal(azureUnknown.provider_output_cost_micros_per_million, undefined);
  assert.equal(azureUnknown.input_credits_per_million, 20_000_000);
  assert.equal(azureUnknown.output_credits_per_million, 100_000_000);
});

test("vision token charges use text multiplier while image units use media multiplier", () => {
  const result = mediaUsageEconomics({
    kind: "vision", imageCount: 1, inputUnits: 1_000_000, outputUnits: 0,
    rate: { inputCreditsPerMillion: 20_000_000, outputCreditsPerMillion: 100_000_000, imageCredits: 200_000 },
  }, 5_000, 20_000);
  assert.deepEqual(result, { credits: 10_400_000, providerCostMicros: 0 });
});

test("multiplier normalization accepts reductions and rejects invalid stored values", () => {
  assert.equal(normalizeRateMultiplierBps(100), 100);
  assert.equal(normalizeRateMultiplierBps(5_000), 5_000);
  assert.equal(normalizeRateMultiplierBps(100_000), 100_000);
  assert.equal(normalizeRateMultiplierBps(0), 10_000);
  assert.equal(normalizeRateMultiplierBps(100_001), 10_000);
  assert.equal(normalizeRateMultiplierBps(Number.NaN), 10_000);
});
