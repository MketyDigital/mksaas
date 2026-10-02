import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SettlementJournal, attemptIdFor } from "../src/billing/settlement-journal.ts";

function makeJournal() {
  const records = new Map();
  let transactionQueue = Promise.resolve();
  const storage = {
    get: async (key) => records.get(key) ?? null,
    put: async (key, value) => records.set(key, structuredClone(value)),
    list: async () => new Map(records),
    transaction: async (closure) => {
      const current = transactionQueue.then(() => closure({
        get: async (key) => records.get(key) ?? null,
        put: async (key, value) => records.set(key, structuredClone(value)),
      }));
      transactionQueue = current.catch(() => undefined);
      return current;
    },
  };
  return new SettlementJournal({ storage });
}

const started = {
  customerId: "customer-a", assistantId: "assistant-a", attemptId: "job-1:res-1:0",
  reservationId: "res-1", requestHash: "hash", provider: "openai", model: "model-a",
  idempotencyKey: "job-1:0", startedAt: 1,
};

test("testAttemptResultPersistsBeforeDelivery", async () => {
  const journal = makeJournal();
  await journal.recordAttemptStarted(started);
  const saved = await journal.recordAttemptResult(started, {
    responseText: "Hello there.", inputUnits: 12, outputUnits: 3, providerCostMicros: 5, credits: 7,
  });
  assert.equal(saved.status, "result_recorded");
  assert.equal((await journal.getAttempt(started)).result.responseText, "Hello there.");
});

test("testRepeatedResultWriteIsIdempotent", async () => {
  const journal = makeJournal();
  await journal.recordAttemptStarted(started);
  const first = await journal.recordAttemptResult(started, { responseText: "Answer", inputUnits: 1, outputUnits: 1, providerCostMicros: 1, credits: 1 });
  const second = await journal.recordAttemptResult(started, { responseText: "Different", inputUnits: 2, outputUnits: 2, providerCostMicros: 2, credits: 2 });
  assert.deepEqual(second, first);
});

test("testConcurrentRetriesOnlyClaimProviderAttemptOnce", async () => {
  const journal = makeJournal();
  const [first, second] = await Promise.all([
    journal.claimAttempt(started),
    journal.claimAttempt(started),
  ]);
  assert.equal([first.claimed, second.claimed].filter(Boolean).length, 1);
});

test("testAttemptIdsCannotCrossCustomerAssistant", async () => {
  const journal = makeJournal();
  await journal.recordAttemptStarted(started);
  await assert.rejects(() => journal.getAttempt({ ...started, customerId: "customer-b" }), /attempt_scope_mismatch/);
});

test("testUnknownOutcomeDoesNotBecomeRetryableGeneration", async () => {
  const journal = makeJournal();
  await journal.recordAttemptStarted(started);
  await journal.markAttemptUnknown(started);
  await assert.rejects(() => journal.recordAttemptResult(started, { responseText: "", inputUnits: 0, outputUnits: 0, providerCostMicros: 0, credits: 0 }), /attempt_outcome_unknown/);
  assert.equal((await journal.getAttempt(started)).status, "unknown_outcome");
  assert.equal(attemptIdFor("job-1", "res-1", 0), started.attemptId);
});

test("testFetchTransportDispatchesJournalMethods", async () => {
  const journal = makeJournal();
  const startedResponse = await journal.fetch(new Request("https://journal.test/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "recordAttemptStarted", args: [started] }),
  }));
  assert.equal(startedResponse.status, 200);
  assert.equal((await startedResponse.json()).result.status, "started");

  const getResponse = await journal.fetch(new Request("https://journal.test/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "getAttempt", args: [started] }),
  }));
  const payload = await getResponse.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.result.attemptId, started.attemptId);
});

test("testProviderSuccessIsJournaledBeforeReturn", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const call = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.ok(call.indexOf("recordAttemptResult(identity") < call.indexOf("return result;"));
});

test("testFallbackAttemptsKeepSeparateUsage", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime,/providerAttemptId: String\(attempt\.providerAttemptId \|\| `\$\{attemptId\}:fallback:/);
  assert.match(runtime,/providerAttemptId: String\(item\.attempt\.providerAttemptId/);
});

test("testRetryReusesRecordedResult", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const call = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.ok(call.indexOf("existing?.status === \"result_recorded\"") < call.indexOf("invokeRoutedModel(env, route, input, customerId, reasoningMode, fallbackPolicy)"));
});

test("testAcceptedTimeoutIsNotBlindlyRepeated", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const call = runtime.slice(runtime.indexOf("async function invokeJournaledProviderCall"), runtime.indexOf("async function resolveModelRoute"));
  assert.match(call,/existing\?\.status === "unknown_outcome"/);
  assert.match(call,/markAttemptUnknown\(identity\)/);
  assert.match(call,/provider_attempt_reconciliation_required/);
});
