import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { routeTargetMediaSupported, routeTargetPricingConfigured } from "../src/providers/route-readiness.ts";

const api = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
const routeReadiness = await import("../src/providers/route-readiness.ts").catch(() => ({}));

test("testPausingTargetLeavesOrderedFallbackIntact", () => {
  assert.match(api, /target\.enabled === false \? 0 : 1/);
  assert.match(api, /position:index|position: index/);
  assert.match(api, /if \(Array\.isArray\(body\.targets\)\)/);
  assert.match(api, /DELETE FROM model_route_targets WHERE scope_key=\?/);
  assert.match(ui, /data-target-enabled/);
  assert.match(ui, /Ordered provider chain/);
});

test("testPausingAliasIsExplicit", () => {
  assert.match(api, /route_readiness: evaluateRouteReadiness/);
  assert.match(api, /status=COALESCE\(\?,status\)/);
  assert.match(ui, /data-route-status/);
  assert.match(ui, /Pause alias|Resume alias/);
});

test("testActiveAliasCannotAccidentallyLoseAllTargets", () => {
  assert.match(api, /active_route_requires_enabled_target/);
  assert.match(api, /nextStatus === "active" && !evaluateRouteReadiness/);
  assert.match(api, /provider_input_cost_micros_per_million:\s*target\.providerInputCostMicrosPerMillion/);
  assert.match(api, /provider_output_cost_micros_per_million:\s*target\.providerOutputCostMicrosPerMillion/);
  assert.match(api, /provider_image_cost_micros:\s*target\.providerImageCostMicros/);
});

test("testMediaPolicyDisabledDiffersFromRouteUnavailable", () => {
  assert.equal(typeof routeReadiness.evaluateMediaReadiness, "function");
  const disabled = routeReadiness.evaluateMediaReadiness({ featureEnabled: false, aliasStatus: "active", targets: [] });
  const unavailable = routeReadiness.evaluateMediaReadiness({ featureEnabled: true, aliasStatus: "active", targets: [] });
  assert.equal(disabled.state, "feature_disabled");
  assert.equal(unavailable.state, "route_unavailable");
  assert.match(api, /media_readiness: mediaReadiness/);
});

test("testVisionAndSpeechReadinessUseValidatedPricedTargets", () => {
  assert.equal(typeof routeReadiness.evaluateMediaReadiness, "function");
  const vision = routeReadiness.evaluateMediaReadiness({ featureEnabled: true, aliasStatus: "active", targets: [
    { enabled: true, validated: true, priced: true },
  ] });
  const speech = routeReadiness.evaluateMediaReadiness({ featureEnabled: true, aliasStatus: "active", targets: [
    { enabled: true, validated: false, priced: true },
    { enabled: true, validated: true, priced: false },
  ] });
  assert.equal(vision.state, "ready");
  assert.equal(vision.eligibleTargetCount, 1);
  assert.equal(speech.state, "route_unavailable");
  assert.equal(speech.eligibleTargetCount, 0);
  assert.equal(routeTargetMediaSupported({ provider: "bedrock" }, "mkety-media-vision"), false);
  assert.equal(routeTargetMediaSupported({ provider: "azure-foundry" }, "mkety-media-vision"), true);
  assert.equal(routeTargetMediaSupported({ provider: "workers-ai" }, "mkety-media-vision"), true);
  assert.equal(routeTargetMediaSupported({ provider: "gemini" }, "mkety-media-speech"), true);
  assert.match(runtime, /routeTargetPricingConfigured\(target, alias\)/);
});

test("testSpeechRouteRequiresCustomerAudioRateEvenWhenTokenRatesExist", () => {
  assert.equal(routeTargetPricingConfigured({
    input_credits_per_million: 500,
    output_credits_per_million: 500,
    audio_credits_per_minute: 0,
  }, "mkety-media-speech"), false);
  assert.equal(routeTargetPricingConfigured({ audio_credits_per_minute: 2 }, "mkety-media-speech"), true);
});

test("vision route accepts token metering only when customer rates cover provider rates", () => {
  assert.equal(routeTargetPricingConfigured({
    input_credits_per_million: 1_000_000,
    output_credits_per_million: 3_000_000,
    provider_input_cost_micros_per_million: 100_000,
    provider_output_cost_micros_per_million: 0,
    image_credits: 0,
  }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({
    input_credits_per_million: 1_000_000,
    output_credits_per_million: 3_000_000,
    provider_input_cost_micros_per_million: 100_000,
    provider_output_cost_micros_per_million: 300_000,
    image_credits: 0,
  }, "mkety-media-vision"), true);
});

test("vision token metering fails closed when either customer rate is below provider cost", () => {
  const base = {
    input_credits_per_million: 1_000_000,
    output_credits_per_million: 3_000_000,
    provider_input_cost_micros_per_million: 100_000,
    provider_output_cost_micros_per_million: 300_000,
    image_credits: 0,
  };
  assert.equal(routeTargetPricingConfigured({ ...base, input_credits_per_million: 999_999 }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({ ...base, output_credits_per_million: 2_999_999 }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({ ...base, provider_output_cost_micros_per_million: 0 }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({
    ...base,
    provider_image_cost_micros: 2,
    image_credits: 19,
  }, "mkety-media-vision"), false);
});

test("vision flat per-image rates require a covered provider image cost", () => {
  assert.equal(routeTargetPricingConfigured({
    image_credits: 20,
    provider_image_cost_micros: 2,
  }, "mkety-media-vision"), true);
  assert.equal(routeTargetPricingConfigured({
    image_credits: 19,
    provider_image_cost_micros: 2,
  }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({
    image_credits: 20,
    provider_image_cost_micros: 2,
    provider_input_cost_micros_per_million: 100,
    input_credits_per_million: 0,
  }, "mkety-media-vision"), false);
  assert.equal(routeTargetPricingConfigured({ image_credits: 3 }, "mkety-media-vision"), false);
});


test("vision provider remains available at the explicit fallback rate when no provider price exists", () => {
  assert.equal(routeTargetPricingConfigured({
    input_credits_per_million: 0,
    output_credits_per_million: 0,
    image_credits: 200_000,
    provider_input_cost_micros_per_million: 0,
    provider_output_cost_micros_per_million: 0,
    provider_image_cost_micros: 0,
  }, "mkety-media-vision"), true);
});


test("media and voice billing reads its own operator multiplier", () => {
  assert.match(runtime, /media_rate_multiplier_bps/);
  assert.match(api, /media_rate_multiplier_bps/);
  assert.match(ui, /Media\/voice rate multiplier %/);
  assert.match(ui, /customerMediaRateMultiplierPercent/);
});
