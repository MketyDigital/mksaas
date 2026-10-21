import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = await readFile(new URL("../migrations/0049_verified_payment_recovery.sql", import.meta.url), "utf8");

test("provider-verified late success recovers a failed checkout and grants once", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE credit_accounts(customer_id TEXT PRIMARY KEY,balance INTEGER NOT NULL,lifetime_granted INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE customers(id TEXT PRIMARY KEY,billing_status TEXT NOT NULL,grace_until INTEGER,updated_at INTEGER NOT NULL);
    CREATE TABLE payment_checkouts(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,credits INTEGER NOT NULL,status TEXT NOT NULL,purchase_type TEXT NOT NULL);
    CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,customer_id TEXT,assistant_id TEXT,delta INTEGER,kind TEXT,reference_id TEXT,balance_after INTEGER,created_at INTEGER);
  `);
  db.exec(migration);
  db.prepare("INSERT INTO customers VALUES ('cus_1','past_due',1,1)").run();
  db.prepare("INSERT INTO credit_accounts VALUES ('cus_1',250,1000,1)").run();
  db.prepare("INSERT INTO payment_checkouts VALUES ('chk_1','cus_1',500,'failed','plan')").run();

  db.prepare("UPDATE payment_checkouts SET status='paid' WHERE id='chk_1' AND status IN ('pending','failed')").run();
  db.prepare("UPDATE payment_checkouts SET status='paid' WHERE id='chk_1'").run();

  const account = db.prepare("SELECT balance,lifetime_granted FROM credit_accounts WHERE customer_id='cus_1'").get();
  assert.equal(account.balance, 750);
  assert.equal(account.lifetime_granted, 1500);
  const customer = db.prepare("SELECT billing_status,grace_until FROM customers WHERE id='cus_1'").get();
  assert.equal(customer.billing_status, "current");
  assert.equal(customer.grace_until, null);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE reference_id='chk_1'").get().count, 1);
  db.close();
});

test("portal return stays non-authoritative and recovery is tied to an owned checkout", async () => {
  const index = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(index, /SELECT \* FROM payment_checkouts WHERE reference=\? AND customer_id=\?/);
  assert.match(index, /WHERE id=\? AND status IN \('pending','failed'\)/);
  assert.match(index, /provider_reference_mismatch/);
  assert.match(index, /verifyAssistPaymentCheckout\(env, checkout, body\.providerPaymentId\)/);
});
