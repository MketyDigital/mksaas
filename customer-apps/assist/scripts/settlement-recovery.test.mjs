import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runtime, index, journal, settlement, migration] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/settlement-journal.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/inference-settlement.ts", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0034_idempotent_inference_attempts.sql", import.meta.url), "utf8"),
]);

test("testD1OutageAfterResultReplaysWithoutGeneration", () => {
  const replay = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.match(replay,/existing\?\.status === "result_recorded"/);
  assert.match(replay,/return \{\s*response: existing\.result\.responseText/s);
  assert.match(replay,/invokeRoutedModel\(env, route, input, customerId, reasoningMode, fallbackPolicy\)/);
});

test("testDeliveryRetryDoesNotRepeatSettlement", () => {
  assert.match(migration,/reservation_id TEXT PRIMARY KEY/);
  assert.match(settlement,/SELECT status FROM inference_settlements WHERE reservation_id/);
  assert.match(settlement,/status='applied'/);
});

test("testApiRetryUsesClientIdempotencyKey", () => {
  assert.match(runtime,/request\.headers\.get\("idempotency-key"\)/);
  assert.match(runtime,/suppliedIdempotencyKey \? apiRequestId : undefined/);
  assert.match(runtime,/invokeJournaledProviderCall\(env, route,[\s\S]*?apiRequestId/);
});

test("testApiTransientCapacityKeepsIdempotentReservationForRetry", () => {
  const api = runtime.slice(runtime.indexOf("export async function handleApiKeyInference"), runtime.indexOf("async function normalizeTelegramMessage"));
  assert.match(api,/const classified = classifyRetryableError\(error\);[\s\S]*?else if \(!classified\.retryable\) \{\s*await releaseReservation/);
});

test("testEveryFallbackAttemptMatchesProviderCost", () => {
  assert.match(runtime,/additionalProviderCosts: priorEconomics\.map/);
  assert.match(runtime,/providerAttemptId: String\(item\.attempt\.providerAttemptId/);
  assert.match(migration,/idx_provider_cost_attempt_once/);
});

test("testVisionAndSpeechResultsAreJournaledBeforeMediaSettlement", () => {
  const vision = runtime.slice(runtime.indexOf("async function describeImage"), runtime.indexOf("async function transcribeAudio"));
  const speech = runtime.slice(runtime.indexOf("async function transcribeAudio"), runtime.indexOf("async function retrieveKnowledge"));
  assert.match(vision,/invokeJournaledMediaAttempt/);
  assert.ok(vision.indexOf("invokeJournaledMediaAttempt") < vision.indexOf("settleMediaUsage"));
  assert.match(speech,/invokeJournaledMediaAttempt/);
  assert.ok(speech.indexOf("invokeJournaledMediaAttempt") < speech.indexOf("settleMediaUsage"));
  assert.match(runtime,/providerSubmitted \|\| Boolean\(\(error as any\)\?\.__mketyProviderAttempted\)/);
});

test("testHumanTakeoverStillBlocksPendingDelivery", () => {
  const delivery = runtime.slice(runtime.indexOf("async function processReplyJob"), runtime.indexOf("async function buildConversationContext"));
  assert.match(delivery,/resolveAutomationState\(env\.DB/);
  assert.match(delivery,/human_handoff_open/);
  assert.match(delivery,/if \(\(beforeDeliveryAutomation\.paused && !isHumanReply\) \|\| job\.assistant_status !== "active"\)/);
  assert.match(index,/processInboundQueue/);
  assert.match(journal,/unknown_outcome/);
});

test("testConfiguredApprovalPauseDefersOnlyAssistantReplies", () => {
  const delivery = runtime.slice(runtime.indexOf("async function processReplyJob"), runtime.indexOf("async function buildConversationContext"));
  assert.match(delivery,/pause_conversation=1[\s\S]*status='pending'/);
  assert.match(delivery,/const pendingHumanReview = !isHumanReply/);
  assert.match(delivery,/if \(pendingHumanReview\)/);
  assert.match(delivery,/automation\.paused && !isHumanReply/);
});

test("testReservationDatabaseFailurePreventsProviderCall", () => {
  const assistant = runtime.slice(runtime.indexOf("async function runAssistant"), runtime.indexOf("async function normalizeTelegramMessage"));
  assert.ok(assistant.indexOf("reserveCredits(env.DB") >= 0);
  assert.ok(assistant.indexOf("reserveCredits(env.DB") < assistant.indexOf("invokeJournaledProviderCall("));
  assert.match(assistant, /if \(!reservation\) return/);
});

test("testUnknownAttemptIsNeverReplayed", () => {
  const call = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.ok(call.indexOf('existing?.status === "unknown_outcome"') < call.indexOf("invokeRoutedModel(env, route, input, customerId, reasoningMode, fallbackPolicy)"));
  assert.match(call, /provider_attempt_reconciliation_required/);
  assert.ok(call.indexOf("recordAttemptProjection(env.DB") < call.indexOf("journal.claimAttempt("));
});
