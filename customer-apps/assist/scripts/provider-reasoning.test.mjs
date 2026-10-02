import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const reasoningModulePath = new URL("../src/providers/reasoning.ts", import.meta.url);
const reasoningModule = await import(reasoningModulePath).catch(() => ({}));
const { providerReasoningOptions, reasoningCapabilities, planReasoningTargets } = reasoningModule;

test("testStandardPreservesAdaptiveEffort", () => {
  assert.equal(existsSync(reasoningModulePath), true, "provider reasoning policy module exists");
  assert.deepEqual(reasoningCapabilities("workers-ai", "@cf/zai-org/glm-5.3-flash", []), ["standard", "high", "maximum"]);
  assert.equal(providerReasoningOptions("workers-ai", "@cf/zai-org/glm-5.3-flash", "standard"), null);
});

test("testHighAndMaximumTranslatePerProvider", () => {
  assert.equal(typeof providerReasoningOptions, "function");
  assert.deepEqual(providerReasoningOptions("workers-ai", "@cf/zai-org/glm-5.3-flash", "high"), { reasoning_effort: "high" });
  assert.deepEqual(providerReasoningOptions("workers-ai", "@cf/zai-org/glm-5.3-flash", "maximum"), { reasoning_effort: "max" });
  assert.deepEqual(providerReasoningOptions("openai", "gpt-5", "maximum"), { reasoning: { effort: "xhigh" } });
  assert.deepEqual(providerReasoningOptions("azure-foundry", "gpt-5.6-sol-1", "maximum"), { reasoning: { effort: "xhigh" } });
  assert.deepEqual(providerReasoningOptions("azure-openai", "gpt-5", "high"), { reasoning_effort: "high" });
  assert.deepEqual(providerReasoningOptions("vertex", "gemini-3-pro", "high"), { generationConfig: { thinkingConfig: { thinkingLevel: "HIGH" } } });
  assert.equal(providerReasoningOptions("workers-ai", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "high"), null);
});

test("testStrictModeSkipsUnsupportedTargets", () => {
  assert.equal(typeof planReasoningTargets, "function");
  const plan = planReasoningTargets([
    { provider: "workers-ai", provider_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", enabled: true },
    { provider: "workers-ai", provider_model: "@cf/zai-org/glm-5.3-flash", enabled: true },
  ], "high", "strict");
  assert.equal(plan.appliedMode, "high");
  assert.deepEqual(plan.targets.map((target) => target.provider_model), ["@cf/zai-org/glm-5.3-flash"]);
});

test("testAllowLowerEffortUsesNextSupportedTier", () => {
  assert.equal(typeof planReasoningTargets, "function");
  const plan = planReasoningTargets([
    { provider: "workers-ai", provider_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", enabled: true },
  ], "high", "allow_lower_effort");
  assert.equal(plan.requestedMode, "high");
  assert.equal(plan.appliedMode, "standard");
  assert.equal(plan.downgraded, true);
  assert.equal(plan.targets.length, 1);
});

test("testStrictNoEligibleTargetFailsClosed", () => {
  assert.equal(typeof planReasoningTargets, "function");
  assert.throws(() => planReasoningTargets([
    { provider: "workers-ai", provider_model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", enabled: true },
  ], "maximum", "strict"), /no_eligible_reasoning_target/);
});

test("testDisabledTargetsAreNeverMadeEligibleByFallback", () => {
  assert.equal(typeof planReasoningTargets, "function");
  assert.throws(() => planReasoningTargets([
    { provider: "workers-ai", provider_model: "@cf/zai-org/glm-5.3-flash", enabled: false },
  ], "high", "allow_lower_effort"), /no_eligible_reasoning_target/);
});

test("testOwnerPreferenceCannotBeOverriddenByAnEndUser", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /invokeRoutedModel\(env, route, input, customerId, reasoningMode, fallbackPolicy\)/);
  assert.match(runtime, /delete requestInput\.reasoning_effort/);
  assert.match(runtime, /__mketyRequestedReasoningMode/);
  assert.match(runtime, /__mketyAppliedReasoningMode/);
});

test("testIncompatibleFallbackTargetDoesNotChangeSelectedEffort", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const resolver = runtime.slice(runtime.indexOf("async function invokeRoutedModel"), runtime.indexOf("function annotateProviderResult"));
  assert.ok(resolver.indexOf("planReasoningTargets(configuredTargets, reasoningMode, fallbackPolicy)") < resolver.indexOf("invokeProviderModel(env, target, requestInput, customerId)"));
  assert.match(resolver, /if \(!eligibleTargetSet\.has\(target\)\) continue/);
  assert.match(resolver, /__mketyAppliedReasoningMode = reasoningPlan\.appliedMode/);
});
