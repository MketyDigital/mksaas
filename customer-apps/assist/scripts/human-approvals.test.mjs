import test from "node:test";
import assert from "node:assert/strict";
import { createHumanApprovalAction, createHumanApprovalRequest, decideHumanApproval, findHumanApprovalAction, normalizeApprovalRequest } from "../src/human-approvals.ts";

test("approval request accepts only bounded supported kinds and safe text", () => {
  assert.deepEqual(normalizeApprovalRequest({
    kind: "verify_payment",
    question: "  Confirm payment?  ",
    summary: "  Receipt uploaded  ",
    idempotencyKey: "conversation-1:payment-1",
  }), {
    kind: "verify_payment",
    question: "Confirm payment?",
    summary: "Receipt uploaded",
    idempotencyKey: "conversation-1:payment-1",
  });
  assert.equal(normalizeApprovalRequest({ kind: "approve_action; DROP TABLE" }), null);
  assert.equal(normalizeApprovalRequest({ kind: "custom", question: "" }), null);
  assert.equal(normalizeApprovalRequest({ kind: "custom", question: "ok", idempotencyKey: "" }), null);
});

test("approval creation scopes conversation and opt-in to the same customer and assistant", async () => {
  const statements = [];
  let firstCall = 0;
  const db = {
    prepare(sql) {
      const statement = { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() { firstCall++; return firstCall === 1 ? null : { approvals_enabled: 1 }; },
        async run() { statements.push(this); return { meta: { changes: 1 } }; } };
      statements.push(statement);
      return statement;
    },
  };
  const result = await createHumanApprovalRequest(db, {
    customerId: "customer-a", assistantId: "assistant-a", conversationId: "conversation-a", requestedBy: "user-a",
    kind: "verify_payment", question: "Confirm payment", summary: "Receipt uploaded", idempotencyKey: "request-a",
    now: 1000, expiresAt: 2000,
  });
  assert.equal(result.status, "pending");
  assert.equal(result.created, true);
  const scopedLookups = statements.filter((statement) => statement.sql.includes("WHERE s.customer_id=? AND s.assistant_id=? AND c.id=?"));
  assert.equal(scopedLookups.length, 1);
  assert.deepEqual(scopedLookups[0].values, ["customer-a", "assistant-a", "conversation-a"]);
});

test("approval decision is a conditional first-writer-wins transaction with audit", async () => {
  let batchStatements;
  const db = {
    prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; } }; },
    async batch(statements) { batchStatements = statements; return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]; },
  };
  const decided = await decideHumanApproval(db, {
    customerId: "customer-a", assistantId: "assistant-a", approvalId: "approval-a", actorUserId: "user-a",
    decision: "approved", decisionText: "Checked", now: 1500,
  });
  assert.equal(decided, true);
  assert.equal(batchStatements.length, 2);
  assert.match(batchStatements[0].sql, /customer_id=\? AND assistant_id=\? AND status='pending' AND expires_at>\?/);
  assert.match(batchStatements[1].sql, /INSERT INTO human_approval_audit[\s\S]*WHERE changes\(\)>0/);
});

test("Telegram action stores only an opaque token hash and binds it to owner and delivery bot", async () => {
  let statement;
  const db = { prepare(sql) { statement = { sql, values: [], bind(...values) { this.values = values; return this; }, async run() { return { meta: { changes: 1 } }; } }; return statement; } };
  const token = "random-one-time-approval-token";
  const tokenHash = await createHumanApprovalAction(db, {
    token, customerId: "customer-a", approvalId: "approval-a", assistantId: "source-assistant",
    deliveryAssistantId: "linked-bot-assistant", userId: "owner-a", decision: "approved", expiresAt: 2000, now: 1000,
  });
  assert.notEqual(tokenHash, token);
  assert.match(statement.sql, /WHERE EXISTS[\s\S]*status='pending'/);
  assert.deepEqual(statement.values.slice(0, 8), [tokenHash,"customer-a","approval-a","source-assistant","linked-bot-assistant","owner-a","approved",2000]);
});

test("Telegram action lookup is bound to its delivery bot and expiry", async () => {
  let statement;
  const db = { prepare(sql) { statement = { sql, values: [], bind(...values) { this.values = values; return this; }, async first() { return null; } }; return statement; } };
  await findHumanApprovalAction(db, "opaque-hash", "linked-bot-assistant", 1000);
  assert.match(statement.sql, /x\.token_hash=\? AND x\.delivery_assistant_id=\? AND x\.expires_at>\?/);
  assert.deepEqual(statement.values, ["opaque-hash","linked-bot-assistant",1000]);
});
