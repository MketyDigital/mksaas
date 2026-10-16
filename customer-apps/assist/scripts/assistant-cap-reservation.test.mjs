import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { reserveInference } from "../src/billing/inference-settlement.ts";

function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE credit_accounts(customer_id TEXT PRIMARY KEY,balance INTEGER NOT NULL,lifetime_consumed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
    CREATE TABLE assistants(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,monthly_credit_cap INTEGER,monthly_credit_cap_mode TEXT NOT NULL DEFAULT 'soft');
    CREATE TABLE usage_events(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT NOT NULL,credits_charged INTEGER NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE credit_reservations(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT NOT NULL,reserved_credits INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,idempotency_key TEXT);
    CREATE UNIQUE INDEX idx_cap_reservation_idempotency ON credit_reservations(customer_id,idempotency_key);
    CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,assistant_id TEXT NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,reference_id TEXT,balance_after INTEGER NOT NULL,created_at INTEGER NOT NULL);
    INSERT INTO credit_accounts(customer_id,balance,updated_at) VALUES ('cus_1',1000,1);
    INSERT INTO assistants(id,customer_id,monthly_credit_cap,monthly_credit_cap_mode) VALUES ('ast_1','cus_1',100,'hard');
  `);
  const wrap = (sql, values = []) => ({
    bind(...args) { return wrap(sql, args); },
    async run() { const result=sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
  });
  let batchQueue=Promise.resolve();
  return {
    prepare: (sql) => wrap(sql),
    batch(statements) {
      const run=batchQueue.then(async()=>{
        sqlite.exec("BEGIN");
        try { const results=[]; for(const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
        catch(error) { sqlite.exec("ROLLBACK"); throw error; }
      });
      batchQueue=run.catch(()=>{});
      return run;
    },
    get(sql,...values) { return sqlite.prepare(sql).get(...values) ?? null; },
    close() { sqlite.close(); },
  };
}

test("hard cap counts settled usage plus open reservations and blocks only the excess", async () => {
  const db=makeDb();
  try {
    const monthStart=Math.floor(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1)/1000);
    db.prepare("INSERT INTO usage_events(id,customer_id,assistant_id,credits_charged,created_at) VALUES('use_1','cus_1','ast_1',40,?)").bind(monthStart).run();
    db.prepare("INSERT INTO credit_reservations(id,customer_id,assistant_id,reserved_credits,status,created_at) VALUES('open_1','cus_1','ast_1',30,'open',?)").bind(monthStart).run();
    assert.equal(await reserveInference(db,"cus_1","ast_1",31,"too_much"),null);
    assert.equal(await reserveInference(db,"cus_1","ast_1",30,"fits" ) && true,true);
    assert.equal(await reserveInference(db,"cus_1","ast_1",1,"over_after_reserve"),null);
    assert.equal(db.get("SELECT balance FROM credit_accounts WHERE customer_id='cus_1'").balance,970);
  } finally { db.close(); }
});

test("parallel hard-cap reservations cannot oversubscribe the remaining allowance", async () => {
  const db=makeDb();
  try {
    const outcomes=await Promise.all([
      reserveInference(db,"cus_1","ast_1",60,"parallel_a"),
      reserveInference(db,"cus_1","ast_1",60,"parallel_b"),
    ]);
    assert.equal(outcomes.filter(Boolean).length,1);
    assert.equal(db.get("SELECT SUM(reserved_credits) AS n FROM credit_reservations WHERE status='open'").n,60);
    assert.equal(db.get("SELECT balance FROM credit_accounts WHERE customer_id='cus_1'").balance,940);
  } finally { db.close(); }
});

test("soft and null caps do not block otherwise funded reservations", async () => {
  const db=makeDb();
  try {
    db.prepare("UPDATE assistants SET monthly_credit_cap_mode='soft' WHERE id='ast_1'").run();
    assert.ok(await reserveInference(db,"cus_1","ast_1",200,"soft"));
    db.prepare("UPDATE credit_accounts SET balance=5000 WHERE customer_id='cus_1'").run();
    db.prepare("UPDATE assistants SET monthly_credit_cap=NULL,monthly_credit_cap_mode='hard' WHERE id='ast_1'").run();
    assert.ok(await reserveInference(db,"cus_1","ast_1",2000,"no_cap"));
  } finally { db.close(); }
});
