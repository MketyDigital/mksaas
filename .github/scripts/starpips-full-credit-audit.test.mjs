import assert from "node:assert/strict";
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  assertReadOnlyQueries, buildAuditSummary, buildFullCreditAuditQueries, encryptReport, safeAuditFailureCode, validateD1BatchResponse,
} from "./starpips-full-credit-audit.mjs";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers(id TEXT,slug TEXT,status TEXT);
    CREATE TABLE credit_accounts(customer_id TEXT,balance INTEGER,lifetime_granted INTEGER,lifetime_consumed INTEGER);
    CREATE TABLE commercial_policy(customer_id TEXT,included_credits INTEGER,rate_multiplier_bps INTEGER,media_rate_multiplier_bps INTEGER,provider_envelope_bps INTEGER,operations_reserve_bps INTEGER);
    CREATE TABLE raw_model_api_settings(customer_id TEXT,enabled INTEGER,allowed_models_json TEXT,updated_at INTEGER);
    CREATE TABLE d1_migrations(name TEXT,applied_at INTEGER);
    CREATE TABLE credit_ledger(id TEXT,customer_id TEXT,assistant_id TEXT,workload_type TEXT,workload_id TEXT,delta INTEGER,kind TEXT,reference_id TEXT,balance_after INTEGER,created_at INTEGER);
    CREATE TABLE credit_reservations(id TEXT,customer_id TEXT,assistant_id TEXT,status TEXT,reserved_credits INTEGER,settled_credits INTEGER,created_at INTEGER);
    CREATE TABLE usage_events(id TEXT,customer_id TEXT,assistant_id TEXT,workload_type TEXT,workload_id TEXT,provider TEXT,provider_model TEXT,model_alias TEXT,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,requested_reasoning_mode TEXT,applied_reasoning_mode TEXT,credits_charged INTEGER,provider_cost_micros INTEGER,created_at INTEGER,provider_attempt_id TEXT,reservation_id TEXT);
    CREATE TABLE raw_model_reservations(id TEXT,customer_id TEXT,api_key_id TEXT,reserved_credits INTEGER,status TEXT,settled_credits INTEGER,created_at INTEGER,settled_at INTEGER,idempotency_key TEXT,resolution_token TEXT);
    CREATE TABLE workload_inference_attempt_index(attempt_id TEXT,customer_id TEXT,workload_type TEXT,workload_id TEXT,reservation_id TEXT,request_hash TEXT,model_alias TEXT,provider TEXT,model TEXT,status TEXT,started_at INTEGER,updated_at INTEGER,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,provider_cost_micros INTEGER,rate_snapshot_json TEXT,requested_reasoning_mode TEXT,applied_reasoning_mode TEXT,resolution_usage_json TEXT,resolution_idempotency_key TEXT,resolved_at INTEGER);
    CREATE TABLE raw_model_settlements(reservation_id TEXT,customer_id TEXT,api_key_id TEXT,claim_token TEXT,status TEXT,actual_credits INTEGER,created_at INTEGER,applied_at INTEGER);
    CREATE TABLE provider_cost_events(id TEXT,customer_id TEXT,usage_event_id TEXT,provider TEXT,provider_model TEXT,cost_micros INTEGER,currency TEXT,created_at INTEGER,provider_attempt_id TEXT);
    CREATE TABLE workload_attempt_resolution_audit(id TEXT,attempt_id TEXT,idempotency_key TEXT,outcome TEXT,evidence_summary TEXT,reason TEXT,operator_user_id TEXT,created_at INTEGER);
    CREATE TABLE inference_attempt_index(attempt_id TEXT,customer_id TEXT,assistant_id TEXT,reservation_id TEXT,reply_job_id TEXT,model_alias TEXT,media_kind TEXT,provider TEXT,model TEXT,status TEXT,started_at INTEGER,updated_at INTEGER,input_units INTEGER,output_units INTEGER,reasoning_units INTEGER,image_units INTEGER,audio_seconds INTEGER,provider_cost_micros INTEGER,requested_reasoning_mode TEXT,applied_reasoning_mode TEXT,resolved_at INTEGER);
    CREATE TABLE model_route_targets(customer_id TEXT,alias TEXT,provider TEXT,provider_model TEXT,enabled INTEGER,position INTEGER,input_credits_per_million INTEGER,output_credits_per_million INTEGER,provider_input_cost_micros_per_million INTEGER,provider_output_cost_micros_per_million INTEGER,provider_image_cost_micros INTEGER,provider_audio_cost_micros_per_minute INTEGER);
    CREATE TABLE model_rates(alias TEXT,version INTEGER,input_credits_per_million INTEGER,output_credits_per_million INTEGER,image_credits INTEGER,audio_credits_per_minute INTEGER,provider_input_cost_micros_per_million INTEGER,provider_output_cost_micros_per_million INTEGER,provider_image_cost_micros INTEGER,provider_audio_cost_micros_per_minute INTEGER,created_at INTEGER);
    CREATE TABLE reply_jobs(id TEXT,customer_id TEXT,status TEXT,last_error TEXT,created_at INTEGER,updated_at INTEGER,attempts INTEGER,image_count INTEGER,audio_seconds INTEGER);
  `);
  db.exec(`INSERT INTO customers VALUES ('cus_1','starpips','active');
    INSERT INTO credit_accounts VALUES ('cus_1',990,1000,10);
    INSERT INTO raw_model_api_settings VALUES ('cus_1',1,'[]',1);
    INSERT INTO raw_model_reservations VALUES ('rres_1','cus_1','key_1',10,'open',NULL,1,NULL,'idem','token');
    INSERT INTO workload_inference_attempt_index VALUES ('att_1','cus_1','api_key','key_1','rres_1','hash','alias','provider','model','unknown_outcome',1,1,NULL,NULL,NULL,NULL,'{}','standard','standard',NULL,NULL,NULL);
    INSERT INTO credit_ledger VALUES ('led_0','cus_1',NULL,NULL,NULL,1000,'credit_grant','grant_1',1000,1);
    INSERT INTO credit_ledger VALUES ('led_1','cus_1',NULL,'api_key','key_1',-10,'inference_reserve','rres_1',990,2);`);
  return db;
}

test("all audit SQL is single-statement read-only and executes against the known schema", () => {
  const queries = buildFullCreditAuditQueries();
  assert.equal(queries.length, 14);
  assert.equal(assertReadOnlyQueries(queries), true);
  const db = makeDb();
  for (const { name, sql } of queries) {
    assert.doesNotThrow(() => db.prepare(sql).all(), name);
  }
  db.close();
});

test("all-time summary checks ledger ties and does not retain request hashes", () => {
  const summary = buildAuditSummary({
    customer_account: [{ balance: 990, lifetime_granted: 1000, lifetime_consumed: 10 }],
    all_credit_ledger_details: [
      { ledger_id: "led_0", reference_id: "grant_1", kind: "credit_grant", delta: 1000, created_at: 800 },
      { ledger_id: "led_1", reference_id: "rres_1", kind: "inference_reserve", workload_type: "api_key", workload_id: "key_1", delta: -10, created_at: 900 },
    ],
    raw_api_reservation_details: [{ reservation_id: "rres_1", api_key_id: "key_1", status: "open", reserved_credits: 10, created_at: 900 }],
    raw_api_attempt_details: [{ attempt_id: "att_1", reservation_id: "rres_1", workload_id: "key_1", request_hash: "private-hash", status: "unknown_outcome", updated_at: 950 }],
  }, 1000);
  assert.equal(summary.accountVsAllLedger.balance_minus_ledger_delta_atoms, 0);
  assert.equal(summary.reservationReconciliation[0].ledger_net_delta_atoms, -10);
  assert.equal(summary.attemptReservationMismatches.length, 0);
  assert.equal(summary.reservationIntegrityAnomalies.length, 0);
  assert.equal(JSON.stringify(summary).includes("private-hash"), false);
});

test("audit query guard rejects a mutation or multi-statement query", () => {
  const valid = buildFullCreditAuditQueries();
  valid[0].sql = "DELETE FROM raw_model_reservations";
  assert.throws(() => assertReadOnlyQueries(valid), /audit_query_not_read_only/);
  const validAgain = buildFullCreditAuditQueries();
  validAgain[0].sql += "; DELETE FROM customers";
  assert.throws(() => assertReadOnlyQueries(validAgain), /audit_query_not_read_only/);
});

test("D1 batch validator requires every query to report zero writes", () => {
  const queries = buildFullCreditAuditQueries();
  const payload = { success: true, result: queries.map(() => ({ success: true, meta: { rows_read: 1, rows_written: 0, changed_db: false }, results: [] })) };
  assert.deepEqual(validateD1BatchResponse(payload, queries), { rowsRead: queries.length, rowsWritten: 0 });
  payload.result[0].meta.rows_written = 1;
  assert.throws(() => validateD1BatchResponse(payload, queries), /d1_read_only_invariant_failed_customer_account/);
  payload.result[0].meta.rows_written = 0;
  payload.result[3] = { success: false, errors: [{ code: 7500, message: "sensitive SQL or row detail" }] };
  assert.throws(
    () => validateD1BatchResponse(payload, queries),
    (error) => error.message === "d1_query_failed_assistant_reservation_details_7500" && !error.message.includes("sensitive"),
  );
});

test("unexpected audit errors expose only a safe stage and error class", () => {
  const code = safeAuditFailureCode("build_reconciliation_report", new TypeError("private D1 response detail"));
  assert.equal(code, "audit_build_reconciliation_report_TypeError");
  assert.equal(code.includes("private"), false);
  assert.equal(safeAuditFailureCode("d1_request", new Error("d1_query_http_403")), "d1_query_http_403");
});

test("encrypted report envelope round-trips and hides plaintext", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });
  const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  const report = { customerSlug: "starpips", privateCharge: 123456 };
  const envelope = JSON.parse(encryptReport(report, publicPem));
  assert.equal(envelope.format, "mkety-assist-encrypted-audit-v1");
  assert.equal(JSON.stringify(envelope).includes("privateCharge"), false);
  const key = privateDecrypt({ key: privatePem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.encryptedKey, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const clear = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
  assert.deepEqual(JSON.parse(clear), report);
});
