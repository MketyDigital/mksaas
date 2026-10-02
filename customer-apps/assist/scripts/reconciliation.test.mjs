import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [runtime, index, journal, migration, settlement, reconciliationSource] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/settlement-journal.ts", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0036_assist_reasoning_reconciliation.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/inference-settlement.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/reconciliation.ts", import.meta.url), "utf8"),
]);
const reconciliation = await import("../src/billing/reconciliation.ts").catch(() => ({}));

test("testDispatchRequiresDurableReconciliationIndex", () => {
  const call = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.ok(call.indexOf("recordAttemptProjection(env.DB") >= 0);
  assert.ok(call.indexOf("recordAttemptProjection(env.DB") < call.indexOf("journal.claimAttempt("));
  assert.ok(call.indexOf("recordAttemptProjection(env.DB") < call.indexOf("invokeRoutedModel(env, route, input, customerId, reasoningMode, fallbackPolicy)"));
  assert.match(reconciliationSource, /reconciliation_index_unavailable/);
});

test("testStaleAttemptListingIsTenantScoped", () => {
  assert.equal(typeof reconciliation.listUnresolvedAttempts, "function");
  assert.match(reconciliation.listUnresolvedAttempts.toString(), /customer_id=\?/);
  assert.match(index, /\/api\/ops\/inference-attempts/);
});

test("testConfirmedNotSubmittedReleasesOnce", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /confirmed_not_submitted/);
  assert.match(source, /releaseInferenceReservation/);
  assert.match(source, /idempotency_key/);
  assert.match(journal, /resolveAttempt\(/);
});

test("testProviderChargedNoResultSettlesEvidencedUsage", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /provider_charged_no_result/);
  assert.match(source, /inputUnits/);
  assert.match(source, /outputUnits/);
  assert.match(source, /settleInference/);
  assert.match(settlement, /INSERT OR IGNORE INTO inference_settlements/);
});

test("testProviderCostWithoutUsageRemainsUnresolved", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /provider_cost_without_billable_usage/);
  assert.match(source, /resultOutcome = "unresolved"/);
});

test("testProviderCostCanBeExplicitlyAbsorbedByMkety", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /mkety_absorbed_cost/);
  assert.match(source, /primaryCredits: 0/);
  assert.match(source, /settleInference/);
  assert.match(index, /mkety_absorbed_cost/);
});

test("testRecoveredResultSettlesAndDelivers", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /recovered_result/);
  assert.match(source, /result_recorded/);
  assert.match(source, /responseText/);
  assert.match(source, /REPLY_QUEUE|replyJobId/);
});

test("testAmbiguousOutcomeRemainsHeld", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /unresolved/);
  assert.match(source, /unknown_outcome/);
  assert.match(runtime, /provider_attempt_reconciliation_required/);
});

test("testResolutionIsIdempotent", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /SELECT attempt_id,outcome FROM inference_attempt_resolution_audit WHERE idempotency_key=\?/);
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/);
});

test("testOperatorResolutionAuditOmitsPromptAndSecret", () => {
  assert.equal(typeof reconciliation.resolveUnknownAttempt, "function");
  const source = reconciliation.resolveUnknownAttempt.toString();
  assert.match(source, /evidence_summary,reason,operator_user_id/);
  assert.doesNotMatch(source, /prompt_text|response_text|api_key|credential/i);
  assert.match(index, /operator_user_id/);
});
