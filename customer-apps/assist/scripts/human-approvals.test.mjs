import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createHumanApprovalAction, createHumanApprovalRequest, decideHumanApproval, findHumanApprovalAction, humanOpsActorCan, normalizeHumanOpsPermission, normalizeApprovalRequest, parseHumanDecisionCall, recordHumanApprovalReply } from "../src/human-approvals.ts";

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
    proposedResponse: "",
    idempotencyKey: "conversation-1:payment-1",
  });
  assert.equal(normalizeApprovalRequest({ kind: "approve_action; DROP TABLE" }), null);
  assert.equal(normalizeApprovalRequest({ kind: "custom", question: "" }), null);
  assert.equal(normalizeApprovalRequest({ kind: "custom", question: "ok", idempotencyKey: "" }), null);
});

test("assistant approval requests use only the constrained enabled action contract", () => {
  assert.deepEqual(parseHumanDecisionCall(JSON.stringify({tool:"request_human_decision",arguments:{kind:"verify_payment",question:"Check receipt",summary:"Receipt attached",proposed_response:"Thanks, I have that."}}),["verify_payment"]),{
    kind:"verify_payment",question:"Check receipt",summary:"Receipt attached",proposedResponse:"Thanks, I have that."
  });
  assert.equal(parseHumanDecisionCall(JSON.stringify({tool:"request_human_decision",arguments:{kind:"approve_action",question:"Approve?"}}),["verify_payment"]),null);
  assert.equal(parseHumanDecisionCall(JSON.stringify({tool:"delete_payment",arguments:{}}),["verify_payment"]),null);
});

test("group permissions are explicit for non-owners and bounded to supported request kinds", () => {
  assert.deepEqual(normalizeHumanOpsPermission({allowedKinds:["verify_payment","delete_customer"],canReply:true}),{
    allowedKinds:["verify_payment"],canReply:true,
  });
  assert.equal(humanOpsActorCan("owner",null,"custom","approved"),true);
  assert.equal(humanOpsActorCan("admin",null,"verify_payment","approved"),false);
  assert.equal(humanOpsActorCan("member",{allowedKinds:["verify_payment"],canReply:false},"verify_payment","approved"),true);
  assert.equal(humanOpsActorCan("member",{allowedKinds:["verify_payment"],canReply:false},"verify_payment","reply"),false);
});

test("Telegram group action claim rechecks current user, destination, scope, and delegated permission atomically", async () => {
  const runtime=await readFile(new URL("../src/runtime.ts",import.meta.url),"utf8");
  const callback=runtime.slice(runtime.indexOf("async function processHumanOpsTelegramCallback"),runtime.indexOf("async function telegramEditMessage"));
  assert.match(callback,/UPDATE human_ops_actions SET used_at=\?[\s\S]*AND EXISTS \([\s\S]*d\.status='active'[\s\S]*u\.status='active'/);
  assert.match(callback,/json_each\(d\.allowed_kinds_json\)/);
  assert.match(callback,/json_each\(d\.assistant_scope_json\)/);
  assert.match(callback,/human_ops_actor_permissions[\s\S]*p\.can_reply=1/);
  const link=runtime.slice(runtime.indexOf("async function handleHumanOpsGroupMessage"),runtime.indexOf("async function processHumanOpsTelegramCallback"));
  assert.match(link,/INSERT INTO human_ops_destinations[\s\S]*consumed_at=\? AND changes\(\)>0/);

  const claimSql=callback.match(/env\.DB\.prepare\(\s*`(UPDATE human_ops_actions[\s\S]*?)`,\s*\)\.bind/)?.[1];
  assert.ok(claimSql,"atomic group action claim SQL missing");
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE human_ops_actions(token_hash TEXT PRIMARY KEY,used_at INTEGER,expires_at INTEGER,customer_id TEXT,approval_id TEXT,assistant_id TEXT,destination_id TEXT,delivery_assistant_id TEXT,action TEXT);
    CREATE TABLE human_ops_destinations(id TEXT,customer_id TEXT,delivery_assistant_id TEXT,chat_id TEXT,status TEXT,allowed_kinds_json TEXT,assistant_scope_json TEXT);
    CREATE TABLE human_approval_requests(id TEXT,customer_id TEXT,assistant_id TEXT,status TEXT,expires_at INTEGER,kind TEXT);
    CREATE TABLE customer_users(customer_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE users(id TEXT,status TEXT,telegram_user_id TEXT);
    CREATE TABLE human_ops_actor_permissions(customer_id TEXT,destination_id TEXT,user_id TEXT,can_reply INTEGER,allowed_kinds_json TEXT);
    INSERT INTO human_ops_actions VALUES ('hash-1',NULL,2000,'cus-1','approval-1','assistant-1','dest-1','bot-1','approved');
    INSERT INTO human_ops_destinations VALUES ('dest-1','cus-1','bot-1','chat-1','active','["verify_payment"]','["assistant-1"]');
    INSERT INTO human_approval_requests VALUES ('approval-1','cus-1','assistant-1','pending',2000,'verify_payment');
    INSERT INTO customer_users VALUES ('cus-1','user-1','admin');
    INSERT INTO users VALUES ('user-1','active','tg-1');
    INSERT INTO human_ops_actor_permissions VALUES ('cus-1','dest-1','user-1',1,'["verify_payment"]');
  `);
  try {
    const claim=sqlite.prepare(claimSql);
    assert.equal(Number(claim.run(1500,"hash-1",1500,"chat-1",1500,"tg-1").changes),1);
    sqlite.prepare("INSERT INTO human_ops_actions VALUES ('hash-2',NULL,2000,'cus-1','approval-1','assistant-1','dest-1','bot-1','approved')").run();
    sqlite.prepare("UPDATE human_ops_actor_permissions SET allowed_kinds_json='[]' WHERE user_id='user-1'").run();
    assert.equal(Number(claim.run(1500,"hash-2",1500,"chat-1",1500,"tg-1").changes),0);
    sqlite.prepare("INSERT INTO human_ops_actions VALUES ('hash-3',NULL,2000,'cus-1','approval-1','assistant-1','dest-1','bot-1','reply')").run();
    assert.equal(Number(claim.run(1500,"hash-3",1500,"chat-1",1500,"tg-1").changes),1);
  } finally { sqlite.close(); }
});

test("approval creation scopes conversation and opt-in to the same customer and assistant", async () => {
  const statements = [];
  let firstCall = 0;
  const db = {
    prepare(sql) {
      const statement = { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() { firstCall++; return firstCall === 1 ? null : { approvals_enabled: 1, allowed_kinds_json: '["verify_payment"]' }; },
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

test("human reply approval and customer delivery job commit atomically and only once", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE human_ops_reply_captures(id TEXT PRIMARY KEY,customer_id TEXT,destination_id TEXT,telegram_user_id TEXT,status TEXT,expires_at INTEGER,captured_at INTEGER);
    CREATE TABLE customer_users(customer_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT,telegram_user_id TEXT);
    CREATE TABLE human_ops_actor_permissions(customer_id TEXT,destination_id TEXT,user_id TEXT,can_reply INTEGER);
    CREATE TABLE human_approval_requests(id TEXT PRIMARY KEY,customer_id TEXT,assistant_id TEXT,status TEXT,decision_text TEXT,decided_by_user_id TEXT,decided_at INTEGER,version INTEGER,expires_at INTEGER);
    CREATE TABLE human_approval_audit(id TEXT PRIMARY KEY,customer_id TEXT,assistant_id TEXT,approval_id TEXT,actor_user_id TEXT,action TEXT,decision_text TEXT,created_at INTEGER,actor_telegram_user_id TEXT,destination_id TEXT);
    CREATE TABLE reply_jobs(id TEXT PRIMARY KEY,customer_id TEXT,assistant_id TEXT,conversation_id TEXT,channel TEXT,external_conversation_id TEXT,provider_message_id TEXT,sender_id TEXT,user_message_id TEXT,user_text TEXT,media_context TEXT,media_usage_json TEXT,image_count INTEGER,audio_seconds INTEGER,business_connection_id TEXT,status TEXT,due_at INTEGER,attempts INTEGER,max_attempts INTEGER,last_enqueued_at INTEGER,created_at INTEGER,updated_at INTEGER,response_text TEXT,delivery_role TEXT,human_approval_id TEXT UNIQUE);
    INSERT INTO human_ops_reply_captures VALUES ('cap-1','cus-1','dest-1','tg-1','pending',2000,NULL);
    INSERT INTO customer_users VALUES ('cus-1','user-1','admin');
    INSERT INTO users VALUES ('user-1','active','tg-1');
    INSERT INTO human_ops_actor_permissions VALUES ('cus-1','dest-1','user-1',1);
    INSERT INTO human_approval_requests VALUES ('approval-1','cus-1','assistant-1','pending',NULL,NULL,NULL,1,2000);
  `);
  const db={
    prepare(sql){const stmt={values:[],bind(...args){this.values=args;return this},async run(){const result=sqlite.prepare(sql).run(...this.values);return{meta:{changes:Number(result.changes)}}}};return stmt},
    async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const stmt of statements)results.push(await stmt.run());sqlite.exec("COMMIT");return results}catch(error){sqlite.exec("ROLLBACK");throw error}},
  };
  const input={customerId:"cus-1",assistantId:"assistant-1",approvalId:"approval-1",captureId:"cap-1",destinationId:"dest-1",telegramUserId:"tg-1",actorUserId:"user-1",replyText:"Thanks, payment is verified.",conversationId:"conv-1",externalConversationId:"chat-1",businessConnectionId:null,replyJobId:"reply-1",auditId:"audit-1",now:1500};
  try {
    assert.equal(await recordHumanApprovalReply(db,input),true);
    assert.equal(await recordHumanApprovalReply(db,{...input,replyJobId:"reply-2",auditId:"audit-2"}),false);
    assert.equal(sqlite.prepare("SELECT status,decision_text FROM human_approval_requests").get().status,"answered");
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM reply_jobs").get().n,1);
    assert.equal(sqlite.prepare("SELECT response_text,delivery_role FROM reply_jobs").get().delivery_role,"human");
    assert.equal(sqlite.prepare("SELECT status FROM human_ops_reply_captures").get().status,"captured");
  } finally { sqlite.close(); }
});
