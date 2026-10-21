import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { assertReadOnlyPaymentQueries, PAYMENT_AUDIT_QUERIES } from './assist-payment-audit.mjs';

test('all D1 payment audit statements are bounded, aggregate, and read-only', () => {
  assert.equal(assertReadOnlyPaymentQueries(), true);
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE payment_checkouts(id TEXT,customer_id TEXT,provider TEXT,purchase_type TEXT,status TEXT,credits INTEGER,canonical_amount_minor INTEGER,created_at INTEGER);
    CREATE TABLE credit_ledger(id TEXT,customer_id TEXT,reference_id TEXT,kind TEXT,delta INTEGER);
    CREATE TABLE credit_accounts(customer_id TEXT);
    INSERT INTO payment_checkouts VALUES ('p1','c1','kora','topup','paid',1000,100,unixepoch()-90000);
    INSERT INTO credit_ledger VALUES ('l1','c1','p1','topup',1000);
    INSERT INTO credit_accounts VALUES ('c1');
    INSERT INTO payment_checkouts VALUES ('p2','c2','nowpayments','plan','pending',500,50,unixepoch()-90000);
  `);
  const results = Object.fromEntries(PAYMENT_AUDIT_QUERIES.map(({ name, sql }) => [name, db.prepare(sql).all()]));
  assert.equal(results.checkout_ledger_integrity[0].paid_without_funding_ledger, 0);
  assert.equal(results.checkout_ledger_integrity[0].paid_ledger_credit_mismatches, 0);
  assert.equal(results.pending_age_summary[0].pending_over_24h, 1);
  db.close();
});

test('query guard rejects writes and multiple statements', () => {
  const queries = structuredClone(PAYMENT_AUDIT_QUERIES);
  queries[0].sql = 'UPDATE payment_checkouts SET status="paid"';
  assert.throws(() => assertReadOnlyPaymentQueries(queries), /not_read_only/);
  const multiple = structuredClone(PAYMENT_AUDIT_QUERIES);
  multiple[0].sql += '; DELETE FROM customers';
  assert.throws(() => assertReadOnlyPaymentQueries(multiple), /not_read_only/);
});
