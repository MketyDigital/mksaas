import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { routeTargetMediaSupported } from "../src/providers/route-readiness.ts";

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
  assert.equal(routeTargetMediaSupported({ provider: "gemini" }, "mkety-media-speech"), true);
  assert.match(runtime, /routeTargetPricingConfigured\(target, alias\)/);
});
