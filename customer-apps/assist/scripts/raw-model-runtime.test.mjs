import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runtime, migration, reconciliation, settlement] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0039_raw_model_api_opt_in.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/reconciliation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/raw-model-settlement.ts", import.meta.url), "utf8"),
]);

test("legacy API keys stay in assistant mode and the raw API remains off by default", () => {
  assert.match(migration, /mode TEXT NOT NULL DEFAULT 'assistant'/);
  assert.match(migration, /enabled INTEGER NOT NULL DEFAULT 0/);
  assert.match(runtime, /if \(keyMode === "raw_model"\) return handleRawModelApiInference/);
});

test("raw model API is scoped to the API key and does not load assistant data", () => {
  const raw = runtime.slice(runtime.indexOf("async function handleRawModelApiInference"), runtime.indexOf("export async function handleApiKeyInference"));
  assert.match(raw, /key\.model_allowlist_json/);
  assert.match(raw, /workloadType: "api_key"/);
  assert.match(raw, /assistant_id: "api_key"|workload_type: "api_key"/);
  assert.doesNotMatch(raw, /assistant_prompt_versions|FROM assistants/);
  assert.match(raw, /messages: modelMessages/);
  assert.match(raw, /idempotency-key/);
  assert.match(raw, /provider_attempt_reconciliation_required/);
});

test("unknown raw provider outcomes are visible and resolvable without an assistant id", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS workload_inference_attempt_index/);
  assert.match(reconciliation, /export async function resolveUnknownWorkloadAttempt/);
  assert.match(settlement, /raw_model_settlements/);
  assert.match(reconciliation, /workload_attempt_resolution_audit/);
});
