import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { reserveRawModelCredits, settleRawModelCredits, releaseRawModelCredits } from "../src/billing/raw-model-settlement.ts";
import { recordAttemptProjection, updateAttemptProjection, listUnresolvedAttempts } from "../src/billing/reconciliation.ts";
import { resolveUnknownWorkloadAttempt, returnUnknownAttemptCredits } from "../src/billing/reconciliation.ts";
import { SettlementJournal } from "../src/billing/settlement-journal.ts";

function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE credit_accounts(customer_id TEXT PRIMARY KEY,balance INTEGER NOT NULL,lifetime_consumed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
    CREATE TABLE customer_api_keys(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL);
    CREATE TABLE raw_model_reservations(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,api_key_id TEXT NOT NULL,reserved_credits INTEGER NOT NULL,status TEXT NOT NULL,settled_credits INTEGER,created_at INTEGER NOT NULL,settled_at INTEGER,idempotency_key TEXT,resolution_token TEXT,UNIQUE(customer_id,api_key_id,idempotency_key));
    CREATE TABLE credit_reservations(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT NOT NULL,reserved_credits INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,idempotency_key TEXT,settled_at INTEGER,resolution_token TEXT);
    CREATE TABLE ops_credit_dispositions(id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,customer_id TEXT NOT NULL,workload_type TEXT NOT NULL,workload_id TEXT NOT NULL,reservation_id TEXT NOT NULL,action TEXT NOT NULL,amount_credits INTEGER NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,reason TEXT NOT NULL,evidence_summary TEXT NOT NULL,operator_user_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(workload_type,attempt_id));
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
    const page = await listUnresolvedAttempts(db, "cus_1");
    const attempts=page.attempts;
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].assistant_id, null);
    assert.equal(attempts[0].workload_type, "api_key");
    assert.equal(attempts[0].workload_id, "key_1");
    assert.equal(attempts[0].status, "unknown_outcome");
  } finally { db.close(); }
});

test("Ops review queue paginates assistant and raw API attempts without skipping equal-time ties", async () => {
  const db=makeDb();
  try {
    const apiReservation=await reserveRawModelCredits(db,"cus_1","key_1",15,"page-api");
    const sameUpdatedAt=Math.floor(Date.now()/1000);
    db.prepare("INSERT INTO credit_reservations(id,customer_id,assistant_id,reserved_credits,status,created_at) VALUES('res_assist','cus_1','ast_1',10,'open',10)").run();
    db.prepare(`INSERT INTO inference_attempt_index(attempt_id,customer_id,assistant_id,reservation_id,model_alias,reply_job_id,conversation_id,media_kind,provider,model,status,started_at,updated_at)
      VALUES('same-id','cus_1','ast_1','res_assist','mkety-smart',NULL,'conv',NULL,'openai','model','unknown_outcome',10,?)`).bind(sameUpdatedAt).run();
    await recordAttemptProjection(db,{attemptId:"same-id",customerId:"cus_1",workloadType:"api_key",workloadId:"key_1",reservationId:apiReservation.id,
      requestHash:"hash",modelAlias:"mkety-economy",conversationId:"api:key_1",provider:"cloudflare-ai",model:"@cf/model",rateSnapshot:{}});
    await updateAttemptProjection(db,{attemptId:"same-id",customerId:"cus_1",workloadType:"api_key",workloadId:"key_1",status:"unknown_outcome"});
    const first=await listUnresolvedAttempts(db,null,1);
    const second=await listUnresolvedAttempts(db,null,1,first.nextCursor);
    assert.equal(first.attempts[0].workload_type,"assistant");
    assert.equal(first.attempts[0].reserved_credits,10);
    assert.equal(second.attempts[0].workload_type,"api_key");
    assert.equal(second.attempts[0].reserved_credits,15);
    assert.equal(second.nextCursor,null);
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

test("Ops goodwill return releases raw API hold once and records evidence separately", async () => {
  const db=makeDb();
  try {
    const reservation=await reserveRawModelCredits(db,"cus_1","key_1",25,"reserve-goodwill");
    const identity={customerId:"cus_1",workloadType:"api_key",workloadId:"key_1",attemptId:"attempt-goodwill"};
    await recordAttemptProjection(db,{...identity,reservationId:reservation.id,requestHash:"hash",modelAlias:"mkety-economy",provider:"cloudflare-ai",model:"@cf/model",rateSnapshot:{}});
    const records=new Map();
    const storage={get:async key=>records.get(key)??null,put:async(key,value)=>records.set(key,structuredClone(value)),transaction:async fn=>fn({get:async key=>records.get(key)??null,put:async(key,value)=>records.set(key,structuredClone(value))})};
    const journal=new SettlementJournal({storage});
    await journal.recordAttemptStarted({...identity,reservationId:reservation.id,requestHash:"hash",provider:"cloudflare-ai",model:"@cf/model",idempotencyKey:"attempt-goodwill",startedAt:1});
    const namespace={idFromName:name=>name,get:()=>({fetch:(url,init)=>journal.fetch(new Request(url,init))})};
    await assert.rejects(returnUnknownAttemptCredits(db,namespace,{...identity,operatorUserId:"ops-1",idempotencyKey:"too-early",reason:"test",evidenceSummary:"test"}),/attempt_outcome_not_eligible_for_goodwill_return/);
    await journal.markAttemptUnknown(identity);
    const input={...identity,operatorUserId:"ops-1",idempotencyKey:"goodwill-1",reason:"Usage cannot be verified; goodwill return approved",evidenceSummary:"Provider outcome remains unknown after checking available logs."};
    const first=await returnUnknownAttemptCredits(db,namespace,input);
    const retry=await returnUnknownAttemptCredits(db,namespace,input);
    await assert.rejects(returnUnknownAttemptCredits(db,namespace,{...input,reason:"changed decision"}),/resolution_idempotency_key_conflict/);
    assert.equal(first.returnedCredits,25);
    assert.equal(retry.idempotent,true);
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id='cus_1'").first()).balance,100);
    assert.equal((await db.prepare("SELECT amount_credits FROM ops_credit_dispositions WHERE attempt_id='attempt-goodwill'").first()).amount_credits,25);
    assert.equal((await db.prepare("SELECT status FROM raw_model_reservations WHERE id=?").bind(reservation.id).first()).status,"released");
  } finally { db.close(); }
});

test("Ops goodwill return releases assistant hold without claiming provider did not submit", async () => {
  const db=makeDb();
  try {
    db.prepare("UPDATE credit_accounts SET balance=80 WHERE customer_id='cus_1'").run();
    db.prepare("INSERT INTO credit_reservations(id,customer_id,assistant_id,reserved_credits,status,created_at) VALUES('res_assist_return','cus_1','ast_1',20,'open',1)").run();
    db.prepare(`INSERT INTO inference_attempt_index(attempt_id,customer_id,assistant_id,reservation_id,model_alias,reply_job_id,conversation_id,media_kind,provider,model,status,started_at,updated_at)
      VALUES('attempt-assist-return','cus_1','ast_1','res_assist_return','mkety-smart',NULL,'conv',NULL,'openai','model','unknown_outcome',1,1)`).run();
    const identity={customerId:"cus_1",assistantId:"ast_1",attemptId:"attempt-assist-return"};
    const records=new Map();
    const storage={get:async key=>records.get(key)??null,put:async(key,value)=>records.set(key,structuredClone(value)),transaction:async fn=>fn({get:async key=>records.get(key)??null,put:async(key,value)=>records.set(key,structuredClone(value))})};
    const journal=new SettlementJournal({storage});
    await journal.recordAttemptStarted({...identity,reservationId:"res_assist_return",requestHash:"hash",provider:"openai",model:"model",idempotencyKey:"attempt-assist-return",startedAt:1});
    await journal.markAttemptUnknown(identity);
    const namespace={idFromName:name=>name,get:()=>({fetch:(url,init)=>journal.fetch(new Request(url,init))})};
    const result=await returnUnknownAttemptCredits(db,namespace,{...identity,workloadType:"assistant",workloadId:"ast_1",operatorUserId:"ops-1",
      idempotencyKey:"goodwill-assistant-1",reason:"Goodwill return approved",evidenceSummary:"Provider outcome cannot be determined from available evidence."});
    assert.equal(result.returnedCredits,20);
    assert.equal((await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id='cus_1'").first()).balance,100);
    assert.equal((await db.prepare("SELECT workload_type,action,amount_credits FROM ops_credit_dispositions WHERE attempt_id='attempt-assist-return'").first()).workload_type,"assistant");
    assert.equal((await db.prepare("SELECT status FROM inference_attempt_index WHERE attempt_id='attempt-assist-return'").first()).status,"unknown_outcome");
    assert.equal((await db.prepare("SELECT status FROM credit_reservations WHERE id='res_assist_return'").first()).status,"released");
  } finally { db.close(); }
});
