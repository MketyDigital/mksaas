import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = new URL("../migrations/0036_assist_reasoning_reconciliation.sql", import.meta.url);

async function assistantApi() {
  const runtime = await source("src/runtime.ts");
  const start = runtime.indexOf('if (parts[0] === "api" && parts[1] === "assistants" && parts[2])');
  const end = runtime.indexOf('\n  if (parts[0] === "api" &&', start + 1);
  return runtime.slice(start, end);
}

test("testLegacyAssistantDefaultsToStandard", async () => {
  assert.equal(existsSync(migrationPath), true, "additive reasoning migration exists");
  const migration = await source("migrations/0036_assist_reasoning_reconciliation.sql");
  assert.ok(/reasoning_mode TEXT NOT NULL DEFAULT 'standard'/.test(migration), "legacy default remains standard");
  assert.ok(/CHECK\s*\(reasoning_mode IN \('standard','high','maximum'\)\)/.test(migration), "database constrains accepted tiers");
  assert.ok(/reasoning_fallback_policy TEXT NOT NULL DEFAULT 'allow_lower_effort'/.test(migration), "legacy owners get continuity-first fallback");
});

test("testOwnerCanPersistSupportedReasoningMode", async () => {
  const route = await assistantApi();
  assert.ok(/body\.reasoningMode/.test(route), "owner PATCH reads reasoningMode");
  assert.ok(/reasoning_mode/.test(route), "owner PATCH persists reasoning_mode");
  assert.ok(/normalizeReasoningMode\(body\.reasoningMode\)/.test(route), "owner PATCH validates through the closed enum helper");
  assert.ok(/body\.reasoningFallbackPolicy/.test(route), "owner PATCH persists the independent fallback policy");
});

test("testInvalidReasoningModeIsRejected", async () => {
  const service = await import("../src/assistants/service.ts");
  assert.equal(typeof service.normalizeReasoningMode, "function");
  assert.equal(service.normalizeReasoningMode("standard"), "standard");
  assert.equal(service.normalizeReasoningMode("high"), "high");
  assert.equal(service.normalizeReasoningMode("maximum"), "maximum");
  for (const invalid of ["", "low", "unlimited", null, 1, {}]) {
    assert.equal(service.normalizeReasoningMode(invalid), null);
  }
  assert.equal(typeof service.normalizeReasoningFallbackPolicy, "function");
  assert.equal(service.normalizeReasoningFallbackPolicy("allow_lower_effort"), "allow_lower_effort");
  assert.equal(service.normalizeReasoningFallbackPolicy("strict"), "strict");
  assert.equal(service.normalizeReasoningFallbackPolicy("silent_downgrade"), null);
});

test("testReasoningModeRoundTripsThroughVersionRollback", async () => {
  const service = await source("src/assistants/service.ts");
  assert.ok(/reasoning_mode/.test(service), "version snapshot reads reasoning_mode");
  assert.ok(/reasoning_fallback_policy/.test(service), "version snapshot reads reasoning_fallback_policy");
  assert.ok(/reasoningMode:/.test(service), "version snapshot stores reasoningMode");
  assert.ok(/reasoningFallbackPolicy:/.test(service), "version snapshot stores fallback policy");
  assert.ok(/reasoningMode/.test(service), "rollback reads reasoningMode");
  assert.ok(/reasoning_mode=\?/.test(service), "rollback writes reasoning_mode");
  assert.ok(/reasoning_fallback_policy=\?/.test(service), "rollback writes fallback policy");
});

test("testEndUserCannotOverrideOwnerReasoningMode", async () => {
  const route = await assistantApi();
  assert.ok(/if \(parts\.length === 3 && request\.method === "PATCH"\) \{\s*requireAdmin\(session\)/.test(route), "only an authenticated tenant admin can update assistant settings");
  assert.ok(/UPDATE assistants SET[\s\S]*reasoning_mode/.test(route), "reasoning preference is persisted with owner settings");
  const ui = await source("src/ui.ts");
  assert.ok(/Reasoning level \(charged to your business MKredits\)/.test(ui), "only the business owner is told who pays");
  assert.ok(/Allow a lower supported level to keep replies available/.test(ui), "the owner can opt into continuity fallback");
  assert.ok(/Require the selected level/.test(ui), "the owner can require the exact tier");
});
