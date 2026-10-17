import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [runtime, index, journal, migration, settlement, reconciliationSource, uiSource] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/settlement-journal.ts", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0036_assist_reasoning_reconciliation.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/inference-settlement.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/reconciliation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/ui.ts", import.meta.url), "utf8"),
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

test("testOpsReviewQueueSupportsGlobalCompositeCursorPagination", () => {
  assert.match(reconciliationSource, /nextCursor/);
  assert.match(reconciliationSource, /workloadType/);
  assert.match(reconciliationSource, /pendingCredits|reserved_credits/);
  assert.match(index, /return json\(page\)/);
});

test("testOpsReviewCursorOrdersAcrossWorkloadsWithoutSkippingTies", () => {
  assert.equal(typeof reconciliation.compareAttemptReviewRows, "function");
  assert.equal(typeof reconciliation.parseAttemptReviewCursor, "function");
  const assistant = { updated_at: 10, attempt_id: "same", workload_type: "assistant" };
  const api = { updated_at: 10, attempt_id: "same", workload_type: "api_key" };
  assert.ok(reconciliation.compareAttemptReviewRows(assistant, api) < 0);
  assert.deepEqual(reconciliation.parseAttemptReviewCursor(JSON.stringify({updatedAt:10,attemptId:"same",workloadType:"assistant"})), {
    updatedAt: 10, attemptId: "same", workloadType: "assistant",
  });
  assert.throws(() => reconciliation.parseAttemptReviewCursor('{"updatedAt":1,"attemptId":"x","workloadType":"owner"}'), /invalid_attempt_review_cursor/);
});

test("testOwnerRoutesDoNotExposeOpsReservationReviewDetails", () => {
  const ownerApi = index.slice(index.indexOf("async function handleCustomerApi"), index.indexOf("async function handleOps"));
  const ownerUi = uiSource.slice(uiSource.indexOf("export function renderCustomerPortal"), uiSource.indexOf("export function renderOperatorPortal"));
  assert.doesNotMatch(ownerApi, /listUnresolvedAttempts|inference_attempt_resolution_audit|evidenceSummary|pendingCredits/);
  assert.doesNotMatch(ownerApi, /ops_credit_dispositions|ops_credit_return/);
  assert.doesNotMatch(ownerUi, /\/api\/ops\/|inference_attempt|ops_credit_dispositions|ops_credit_return/);
  assert.match(index, /if \(host === env\.OPS_HOST\)\s*\{\s*return handleOps/);
  assert.match(index, /const operator = await requireOperatorSession\(request, env\)/);
});

test("testOpsCanExplicitlyReturnUnknownHoldAsAuditedGoodwillCredit", async () => {
  const migration43 = await readFile(new URL("../migrations/0046_ops_credit_dispositions.sql", import.meta.url), "utf8");
  assert.equal(typeof reconciliation.returnUnknownAttemptCredits, "function");
  assert.match(migration43, /ops_credit_dispositions/);
  assert.match(index, /ops_credit_return/);
  assert.match(reconciliationSource, /ops_credit_return/);
  assert.match(reconciliationSource, /goodwill/);
});

test("testAttemptResolutionHistoryIsExposedOnlyThroughOpsApi", () => {
  assert.match(index,/\/api\/ops\/inference-attempts\/.*\/history/);
  assert.match(index,/workload_attempt_resolution_audit/);
  assert.match(index,/inference_attempt_resolution_audit/);
  assert.match(uiSource,/loadAttemptHistory/);
  assert.doesNotMatch(uiSource.slice(uiSource.indexOf("export function renderCustomerPortal"),uiSource.indexOf("export function renderOperatorPortal")),/loadAttemptHistory|\/api\/ops\//);
});
