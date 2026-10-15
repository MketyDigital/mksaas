import test from "node:test";
import assert from "node:assert/strict";
import { buildCreditAuditQueries, renderCreditAudit, validateAuditInput } from "./credit-audit.mjs";
import { readFileSync } from "node:fs";

test("audit input is strictly bounded", () => {
  assert.deepEqual(validateAuditInput("customer-123", 30), { customerId: "customer-123", days: 30 });
  for (const id of ["x' OR 1=1 --", "has space", "", "a".repeat(81)]) assert.throws(() => validateAuditInput(id, 30));
  for (const days of [0, -1, 91, 1.2, "no"]) assert.throws(() => validateAuditInput("starpips", days));
});

test("queries are scoped, bounded, select aggregates and contain no mutations", () => {
  const queries = buildCreditAuditQueries("starpips", 30);
  assert.equal(queries.length, 16);
  for (const [index, { sql }] of queries.entries()) {
    assert.match(sql, /SELECT/i);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE|VACUUM|PRAGMA)\b/i);
    if (![12, 13].includes(index)) assert.match(sql, /starpips/);
  }
  assert.match(queries[0].sql, /lifetime_consumed/);
  assert.match(queries[2].sql, /provider_cost_micros/);
  assert.match(queries[3].sql, /credit_reservations/);
  assert.match(queries[5].sql, /inference_attempt_index/);
  assert.match(queries[8].sql, /last_error/);
  assert.match(queries[9].sql, /length\(p.instructions\)/);
  assert.doesNotMatch(queries[9].sql, /p\.instructions\s*(,|FROM)/);
  assert.doesNotMatch(queries[10].sql, /content|body|text/i);
  assert.match(queries[13].sql, /d1_migrations/);
  assert.match(queries[14].sql, /provider_attempt_id/);
});

test("report has a privacy declaration and cannot embed raw text fields from sources", () => {
  const report = renderCreditAudit({ customerId: "starpips", days: 30, results: [{ name: "x", rows: [{ count: 3 }] }] });
  assert.equal(report.readOnly, true);
  assert.match(report.privacy, /No message, prompt, transcript/);
  assert.deepEqual(report.sections.x, [{ count: 3 }]);
});

test("manual action is dispatch only and contains no deploy or migration command", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/mkety-assist-starpips-credit-audit.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy|d1\s+migrations\s+apply|wrangler\s+secret\s+put/i);
  assert.match(workflow, /actions\/upload-artifact/);
});
