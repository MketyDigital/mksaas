import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { reserveRawModelCredits, settleRawModelCredits, releaseRawModelCredits } from "../src/billing/raw-model-settlement.ts";
import { recordAttemptProjection, updateAttemptProjection, listUnresolvedAttempts } from "../src/billing/reconciliation.ts";
import { resolveUnknownWorkloadAttempt } from "../src/billing/reconciliation.ts";
import { SettlementJournal } from "../src/billing/settlement-journal.ts";

function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE credit_accounts(customer_id TEXT PRIMARY KEY,balance INTEGER NOT NULL,lifetime_consumed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
    CREATE TABLE customer_api_keys(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL);
    CREATE TABLE raw_model_reservations(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,api_key_id TEXT NOT NULL,reserved_credits INTEGER NOT NULL,status TEXT NOT NULL,settled_credits INTEGER,created_at INTEGER NOT NULL,settled_at INTEGER,idempotency_key TEXT,resolution_token TEXT,UNIQUE(customer_id,api_key_id,idempotency_key));
    CREATE TABLE raw_model_settlements(reservation_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,api_key_id TEXT NOT NULL,claim_token TEXT NOT NULL UNIQUE,status TEXT NOT NULL,actual_credits INTEGER NOT NULL,created_at INTEGER NOT NULL,applied_at INTEGER);
    CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT,workload_type TEXT,workload_id TEXT,delta INTEGER NOT NULL,kind TEXT NOT NULL,reference_id TEXT,balance_after INTEGER NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE usage_events(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT,workload_type TEXT,workload_id TEXT,api_key_id TEXT,conversation_id TEXT,model_alias TEXT,provider TEXT,provider_model TEXT,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,requested_reasoning_mode TEXT,applied_reasoning_mode TEXT,credits_charged INTEGER,provider_cost_micros INTEGER,created_at INTEGER,provider_attempt_id TEXT UNIQUE,reservation_id TEXT);
    CREATE TABLE provider_cost_events(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,usage_event_id TEXT,provider TEXT,provider_model TEXT,cost_micros INTEGER,currency TEXT,created_at INTEGER,provider_attempt_id TEXT UNIQUE);
    CREATE TABLE workload_inference_attempt_index(attempt_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,workload_type TEXT NOT NULL,workload_id TEXT NOT NULL,reservation_id TEXT NOT NULL,request_hash TEXT NOT NULL,model_alias TEXT NOT NULL,conversation_id TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,provider_cost_micros INTEGER,rate_snapshot_json TEXT NOT NULL,requested_reasoning_mode TEXT NOT NULL,applied_reasoning_mode TEXT NOT NULL,resolution_usage_json TEXT,resolution_idempotency_key TEXT,resolved_at INTEGER);
    CREATE TABLE inference_attempt_index(attempt_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT NOT NULL,reservation_id TEXT NOT NULL,model_alias TEXT NOT NULL,reply_job_id TEXT,conversation_id TEXT NOT NULL,media_kind TEXT,provider TEXT NOT NULL,model TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,image_units INTEGER,audio_seconds REAL,provider_cost_micros INTEGER,requested_reasoning_mode TEXT,applied_reasoning_mode TEXT,resolved_at INTEGER);
    CREATE TABLE workload_attempt_resolution_audit(id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,outcome TEXT NOT NULL,evidence_summary TEXT NOT NULL,reason TEXT NOT NULL,operator_user_id TEXT NOT NULL,created_at INTEGER NOT NULL);
    INSERT INTO credit_accounts(customer_id,balance,updated_at) VALUES ('cus_1',100,1);
    INSERT INTO customer_api_keys(id,customer_id) VALUES ('key_1','cus_1');
  `);
  const wrap = (sql, values = []) => ({
    bind(...args) { return wrap(sql, args); },
    async run() {
      try { sqlite.prepare(sql).run(...values); } catch (error) { error.message += ` SQL=${sql} values=${values.length}`; throw error; }
      return { meta: { changes: sqlite.prepare("SELECT changes() AS n").get().n } };
    },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
  });
  return {
    prepare: (sql) => wrap(sql),
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    first: (sql, ...values) => sqlite.prepare(sql).get(...values) ?? null,
    close: () => sqlite.close(),
  };
}

test("raw model reservations debit once and settle with neutral workload attribution", async () => {
  const db = makeDb();
  try {
    const reservation = await reserveRawModelCredits(db, "cus_1", "key_1", 20, "idem-1");
    assert.equal(reservation.status, "open");
    assert.equal((await reserveRawModelCredits(db, "cus_1", "key_1", 20, "idem-1")).id, reservation.id);
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind("cus_1").first()).balance, 80);

    assert.equal(await settleRawModelCredits(db, reservation.id, "cus_1", "key_1", 20, 7, {
      modelAlias: "mkety-economy", provider: "cloudflare-ai", providerModel: "@cf/model", conversationId: "api:key_1",
      inputUnits: 10, outputUnits: 5, providerCostMicros: 11, providerAttemptId: "attempt-1",
      additionalProviderCosts: [{ provider: "openai", providerModel: "gpt-test", inputUnits: 2, outputUnits: 1, providerCostMicros: 3, providerAttemptId: "attempt-fallback" }],
    }), true);
    assert.equal(await settleRawModelCredits(db, reservation.id, "cus_1", "key_1", 20, 7, {
      modelAlias: "mkety-economy", provider: "cloudflare-ai", providerModel: "@cf/model", conversationId: "api:key_1",
      inputUnits: 10, outputUnits: 5, providerCostMicros: 11, providerAttemptId: "attempt-1",
      additionalProviderCosts: [{ provider: "openai", providerModel: "gpt-test", inputUnits: 2, outputUnits: 1, providerCostMicros: 3, providerAttemptId: "attempt-fallback" }],
    }), true);

    const usage = await db.prepare("SELECT assistant_id,workload_type,workload_id,api_key_id,credits_charged FROM usage_events").first();
    assert.deepEqual({ ...usage }, { assistant_id: null, workload_type: "api_key", workload_id: "key_1", api_key_id: "key_1", credits_charged: 7 });
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind("cus_1").first()).balance, 93);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM provider_cost_events").first()).n, 2);
    assert.equal((await db.prepare("SELECT assistant_id,workload_type,workload_id FROM credit_ledger WHERE kind='inference_reserve'").first()).assistant_id, null);
  } finally { db.close(); }
});

test("raw model release restores a reservation only once", async () => {
  const db = makeDb();
  try {
    const reservation = await reserveRawModelCredits(db, "cus_1", "key_1", 15);
    assert.equal(await releaseRawModelCredits(db, reservation.id, "cus_1", "key_1"), true);
    assert.equal(await releaseRawModelCredits(db, reservation.id, "cus_1", "key_1"), false);
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind("cus_1").first()).balance, 100);
  } finally { db.close(); }
});

test("raw provider attempts stay visible in reconciliation with API-key workload identity", async () => {
  const db = makeDb();
  try {
    const reservation = await reserveRawModelCredits(db, "cus_1", "key_1", 15);
    const projection = { attemptId: "attempt-raw", customerId: "cus_1", workloadType: "api_key", workloadId: "key_1",
      reservationId: reservation.id, requestHash: "hash", modelAlias: "mkety-economy", conversationId: "api:key_1",
      provider: "cloudflare-ai", model: "@cf/model", rateSnapshot: { rate_multiplier_bps: 10000 } };
    await recordAttemptProjection(db, projection);
    await updateAttemptProjection(db, { ...projection, status: "unknown_outcome", providerCostMicros: 9 });
    const attempts = await listUnresolvedAttempts(db, "cus_1");
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].assistant_id, null);
    assert.equal(attempts[0].workload_type, "api_key");
    assert.equal(attempts[0].workload_id, "key_1");
    assert.equal(attempts[0].status, "unknown_outcome");
  } finally { db.close(); }
});

test("operator can reconcile raw unknown outcome without assigning an assistant", async () => {
  const db = makeDb();
  try {
    const reservation = await reserveRawModelCredits(db, "cus_1", "key_1", 15);
    const identity = { customerId: "cus_1", workloadType: "api_key", workloadId: "key_1", attemptId: "attempt-raw-reconcile" };
    await recordAttemptProjection(db, { ...identity, reservationId: reservation.id, requestHash: "hash", modelAlias: "mkety-economy",
      provider: "cloudflare-ai", model: "@cf/model", rateSnapshot: {} });
    const records = new Map();
    const storage = { get: async (key) => records.get(key) ?? null, put: async (key,value) => records.set(key,structuredClone(value)),
      transaction: async (fn) => fn({get:async(key)=>records.get(key)??null,put:async(key,value)=>records.set(key,structuredClone(value))}) };
    const journal = new SettlementJournal({storage});
    const fullIdentity = {...identity,reservationId:reservation.id,requestHash:"hash",provider:"cloudflare-ai",model:"@cf/model",idempotencyKey:identity.attemptId,startedAt:1};
    await journal.recordAttemptStarted(fullIdentity);
    await journal.markAttemptUnknown(identity);
    const namespace = { idFromName: (name) => name, get: () => ({ fetch: (url,init) => journal.fetch(new Request(url,init)) }) };
    const result = await resolveUnknownWorkloadAttempt(db, namespace, { ...identity, operatorUserId: "ops-1",
      outcome: "confirmed_not_submitted", idempotencyKey: "resolve-1", evidenceSummary: "Provider logs confirm no request was accepted.", reason: "No provider dispatch" });
    assert.equal(result.outcome, "confirmed_not_submitted");
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind("cus_1").first()).balance, 100);
    assert.equal((await db.prepare("SELECT outcome FROM workload_attempt_resolution_audit").first()).outcome, "confirmed_not_submitted");
  } finally { db.close(); }
});
