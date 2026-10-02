import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateInferenceCredits } from "../src/billing/metering.ts";

const [runtime, settlementSource, migration21, migration34] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/billing/inference-settlement.ts", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0021_metering_invariants.sql", import.meta.url), "utf8"),
  readFile(new URL("../migrations/0034_idempotent_inference_attempts.sql", import.meta.url), "utf8"),
]);
const settlement = settlementSource.slice(settlementSource.indexOf("export async function settleInference"));
const release = settlementSource.slice(settlementSource.indexOf("export async function releaseInferenceReservation"), settlementSource.indexOf("export async function settleInference"));

test("testReservationIsUniquePerReplyJob", () => {
  assert.match(runtime, /`reply-job:\$\{input\.replyJobId\}`/);
  assert.match(migration21, /UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_idempotency/);
});

test("testSettlementWritesLedgerAndUsageAtomically", () => {
  assert.match(settlement, /await db\.batch\(statements\)/);
  assert.match(settlement, /INSERT INTO usage_events/);
  assert.match(settlement, /INSERT INTO provider_cost_events/);
  assert.match(settlement, /INSERT INTO credit_ledger/);
  assert.match(settlement, /claim_token/);
});

test("testDuplicateSettlementDoesNotDoubleCharge", () => {
  assert.match(migration21, /UNIQUE INDEX IF NOT EXISTS idx_usage_reservation_once/);
  assert.match(migration34, /reservation_id TEXT PRIMARY KEY/);
  assert.match(migration34, /idx_usage_provider_attempt_once/);
  assert.match(migration34, /idx_provider_cost_attempt_once/);
  assert.match(settlement, /INSERT OR IGNORE INTO inference_settlements/);
});

test("testUnusedReservationIsReleasedOnce", () => {
  assert.match(release, /status='open'/);
  assert.match(release, /resolution_token/);
  assert.match(release, /await db\.batch\(/);
  assert.match(migration34, /ALTER TABLE credit_reservations ADD COLUMN resolution_token/);
});

test("testReasoningUnitsUseConfiguredRate", () => {
  const separateReasoningRate = calculateInferenceCredits({
    inputUnits: 0, outputUnits: 0, reasoningUnits: 1_000_000,
    inputCreditsPerMillion: 0, outputCreditsPerMillion: 0,
    reasoningCreditsPerMillion: 2,
  });
  const outputRateFallback = calculateInferenceCredits({
    inputUnits: 0, outputUnits: 1_000_000, reasoningUnits: 1_000_000,
    inputCreditsPerMillion: 0, outputCreditsPerMillion: 3,
  });
  assert.equal(separateReasoningRate, 2);
  assert.equal(outputRateFallback, 3);
  assert.equal(calculateInferenceCredits({
    inputUnits: 0, outputUnits: 1_000_000, reasoningUnits: 1_000_000,
    inputCreditsPerMillion: 0, outputCreditsPerMillion: 3,
  }), 3, "reported reasoning tokens already included in output are not charged twice");
});
