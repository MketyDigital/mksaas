import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiKeyMode, normalizeModelAllowlist, canUseRawModelApi } from "../src/api-key-policy.ts";

test("existing and unspecified API keys keep assistant mode", () => {
  assert.equal(normalizeApiKeyMode(undefined), "assistant");
  assert.equal(normalizeApiKeyMode("assistant"), "assistant");
  assert.equal(normalizeApiKeyMode("raw_model"), "raw_model");
  assert.throws(() => normalizeApiKeyMode("admin"), /api_key_mode_invalid/);
});

test("raw model calls require customer opt-in and a key allowlist match", () => {
  const allowed = normalizeModelAllowlist('["mkety-economy","mkety-smart"]');
  assert.deepEqual(allowed, ["mkety-economy", "mkety-smart"]);
  assert.equal(canUseRawModelApi({ enabled: false, allowlist: allowed, alias: "mkety-economy" }), false);
  assert.equal(canUseRawModelApi({ enabled: true, allowlist: allowed, alias: "mkety-smart" }), true);
  assert.equal(canUseRawModelApi({ enabled: true, allowlist: allowed, alias: "mkety-other" }), false);
});

test("model allowlists reject malformed, excessive, and duplicate values", () => {
  assert.throws(() => normalizeModelAllowlist('["not-an-alias"]'), /model_allowlist_invalid/);
  assert.throws(() => normalizeModelAllowlist(JSON.stringify(Array.from({ length: 21 }, (_, i) => `mkety-model-${i}`))), /model_allowlist_invalid/);
  assert.throws(() => normalizeModelAllowlist('["mkety-economy","mkety-economy"]'), /model_allowlist_invalid/);
});
