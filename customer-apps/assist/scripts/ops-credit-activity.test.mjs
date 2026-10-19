import assert from "node:assert/strict";
import test from "node:test";

const activity = await import("../src/billing/operator-credit-activity.ts").catch(() => ({}));

test("operator credit activity filters bound customer, date range, type, and capped paging", () => {
  assert.equal(typeof activity.normalizeCreditActivityFilters, "function");
  assert.deepEqual(activity.normalizeCreditActivityFilters(new URLSearchParams({
    customerId: "cust_123", type: "usage", from: "1792000000", to: "1793000000", limit: "1000", offset: "40",
  })), {
    customerId: "cust_123", type: "usage", from: 1792000000, to: 1793000000, limit: 100, offset: 40,
  });
});

test("operator credit activity query is read-only and keeps charge streams distinct", () => {
  assert.equal(typeof activity.buildCreditActivityQuery, "function");
  const query = activity.buildCreditActivityQuery({
    customerId: "cust_123", type: "all", from: 10, to: 20, limit: 25, offset: 50,
  });
  assert.match(query.sql, /UNION ALL/);
  assert.match(query.sql, /FROM credit_ledger/);
  assert.match(query.sql, /FROM usage_events/);
  assert.match(query.sql, /FROM payment_checkouts/);
  assert.match(query.sql, /ORDER BY l\.created_at DESC,l\.id DESC LIMIT \?/);
  assert.match(query.sql, /ORDER BY u\.created_at DESC,u\.id DESC LIMIT \?/);
  assert.match(query.sql, /ORDER BY p\.created_at DESC,p\.id DESC LIMIT \?/);
  assert.equal((query.sql.match(/LIMIT \?/g) || []).length, 4);
  assert.match(query.sql, /customer_id=\?/);
  assert.match(query.sql, /created_at>=\?/);
  assert.match(query.sql, /created_at<\?/);
  assert.doesNotMatch(query.sql, /INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i);
  assert.doesNotMatch(query.sql, /api_key_secret|token_hash|secret_ciphertext|prompt/i);
  assert.deepEqual(query.values, ["cust_123", 10, 20, 75, "cust_123", 10, 20, 75, "cust_123", 10, 20, 75, 25, 50]);
});

test("operator credit activity has created-at indexes for bounded global pages", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(new URL("../migrations/0048_ops_credit_activity_indexes.sql", import.meta.url), "utf8");
  assert.match(migration, /idx_ops_credit_ledger_activity\s+ON credit_ledger\(created_at DESC,id DESC\)/);
  assert.match(migration, /idx_ops_usage_events_activity\s+ON usage_events\(created_at DESC,id DESC\)/);
  assert.match(migration, /idx_ops_payment_checkouts_activity\s+ON payment_checkouts\(created_at DESC,id DESC\)/);
});

test("operator credit activity never accepts invalid filters or unbounded pages", () => {
  const filters = activity.normalizeCreditActivityFilters(new URLSearchParams({
    customerId: "all", type: "arbitrary", from: "not-a-time", to: "-1", limit: "0", offset: "-500",
  }));
  assert.deepEqual(filters, { customerId: null, type: "all", from: null, to: null, limit: 1, offset: 0 });
  assert.ok(activity.normalizeCreditActivityFilters(new URLSearchParams({ limit: "200000", offset: "9000000" })).offset <= 100000);
  assert.equal(activity.normalizeCreditActivityFilters(new URLSearchParams({ from: "100", to: "90" })).to, 100);
});

test("operator credit activity endpoint is session-protected and returns MKredit and USD units", async () => {
  const { readFile } = await import("node:fs/promises");
  const index = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  const auth = index.indexOf("const operator = await requireOperatorSession(request, env)");
  const route = index.indexOf('url.pathname === "/api/ops/credit-activity"');
  assert.ok(auth >= 0 && route > auth);
  const handler = index.slice(route, index.indexOf('url.pathname === "/api/ops/pricing/calculate"', route));
  assert.match(handler, /normalizeCreditActivityFilters/);
  assert.match(handler, /mkreditsFromCreditAtoms\(row\.amount\)/);
  assert.match(handler, /Number\(row\.payment_amount_minor\) \/ 100/);
  assert.match(handler, /Number\(row\.provider_cost_micros\) \/ 1_000_000/);
  assert.match(handler, /nextOffset: hasMore/);
});
