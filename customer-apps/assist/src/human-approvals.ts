/* eslint-disable @typescript-eslint/no-explicit-any */

export type ApprovalKind = "verify_payment" | "verify_partner_signup" | "approve_action" | "human_answer" | "custom";
export type ApprovalDecision = "approved" | "rejected" | "answered";

const KINDS = new Set<ApprovalKind>(["verify_payment", "verify_partner_signup", "approve_action", "human_answer", "custom"]);

export function normalizeHumanOpsPermission(input: any) {
  const allowedKinds = Array.isArray(input?.allowedKinds)
    ? [...new Set(input.allowedKinds.map(String).filter((kind: string) => KINDS.has(kind as ApprovalKind)))].slice(0, KINDS.size)
    : [];
  return { allowedKinds: allowedKinds as ApprovalKind[], canReply: input?.canReply === true };
}

export function humanOpsActorCan(role: string, permission: { allowedKinds: string[]; canReply: boolean } | null, kind: string, action: string) {
  if (role === "owner") return true;
  if (!permission || !KINDS.has(kind as ApprovalKind)) return false;
  return action === "reply" ? permission.canReply : permission.allowedKinds.includes(kind);
}

export function normalizeApprovalRequest(input: any): {
  kind: ApprovalKind;
  question: string;
  summary: string;
  proposedResponse: string;
  idempotencyKey: string;
} | null {
  const kind = String(input?.kind || "") as ApprovalKind;
  const question = typeof input?.question === "string" ? input.question.trim().slice(0, 1000) : "";
  const summary = typeof input?.summary === "string" ? input.summary.trim().slice(0, 2000) : "";
  const proposedResponse = typeof input?.proposedResponse === "string" ? input.proposedResponse.trim().slice(0, 1000) : "";
  const idempotencyKey = typeof input?.idempotencyKey === "string" ? input.idempotencyKey.trim().slice(0, 160) : "";
  if (!KINDS.has(kind) || !question || !idempotencyKey) return null;
  return { kind, question, summary, proposedResponse, idempotencyKey };
}

export function parseHumanDecisionCall(text: string, allowedKinds: string[]) {
  const normalized = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  if (!normalized.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(normalized);
    if (parsed?.tool !== "request_human_decision" || !parsed.arguments || typeof parsed.arguments !== "object") return null;
    const args = parsed.arguments;
    const kind = String(args.kind || "");
    const question = typeof args.question === "string" ? args.question.trim().slice(0,1000) : "";
    if (!KINDS.has(kind as ApprovalKind) || !allowedKinds.includes(kind) || !question) return null;
    return {
      kind: kind as ApprovalKind,
      question,
      summary: typeof args.summary === "string" ? args.summary.trim().slice(0,2000) : "",
      proposedResponse: typeof args.proposed_response === "string" ? args.proposed_response.trim().slice(0,1000) : "",
    };
  } catch { return null; }
}

const id = () => `approval_${crypto.randomUUID().replace(/-/g, "")}`;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function createHumanApprovalRequest(db: D1Database, input: {
  customerId: string; assistantId: string; conversationId: string; requestedBy: string;
  kind: ApprovalKind; question: string; summary: string; proposedResponse?: string; evidenceMessageIds?: string[];
  idempotencyKey: string; expiresAt: number; now: number;
}) {
  const evidenceMessageIds = (input.evidenceMessageIds || []).slice(0, 20);
  const requestHash = await hash(JSON.stringify({
    conversationId: input.conversationId, requestedBy: input.requestedBy, kind: input.kind,
    question: input.question, summary: input.summary, proposedResponse: input.proposedResponse || "", evidenceMessageIds,
  }));
  const prior = await db.prepare(
    "SELECT id,status,request_hash FROM human_approval_requests WHERE customer_id=? AND assistant_id=? AND idempotency_key=? LIMIT 1",
  ).bind(input.customerId, input.assistantId, input.idempotencyKey).first<any>();
  if (prior) {
    if (String(prior.request_hash) !== requestHash) throw new Error("approval_idempotency_conflict");
    return { id: String(prior.id), status: String(prior.status), created: false };
  }

  const assistant = await db.prepare(
    `SELECT s.approvals_enabled,s.allowed_kinds_json FROM human_operations_settings s
     JOIN conversations c ON c.assistant_id=s.assistant_id AND c.customer_id=s.customer_id
     WHERE s.customer_id=? AND s.assistant_id=? AND c.id=? LIMIT 1`,
  ).bind(input.customerId, input.assistantId, input.conversationId).first<any>();
  let allowedKinds: string[] = [];
  try { allowedKinds = JSON.parse(String(assistant?.allowed_kinds_json || "[]")); } catch {}
  if (!assistant || Number(assistant.approvals_enabled) !== 1 || !allowedKinds.includes(input.kind)) return null;

  const approvalId = id();
  const evidence = JSON.stringify(evidenceMessageIds);
  const result = await db.prepare(
    `INSERT OR IGNORE INTO human_approval_requests
     (id,customer_id,assistant_id,conversation_id,requested_by,kind,question,summary,proposed_response,evidence_message_ids_json,status,created_at,expires_at,idempotency_key,request_hash,version)
     SELECT ?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,1
     WHERE EXISTS (SELECT 1 FROM conversations WHERE id=? AND customer_id=? AND assistant_id=?)
       AND EXISTS (SELECT 1 FROM human_operations_settings WHERE customer_id=? AND assistant_id=? AND approvals_enabled=1)`,
  ).bind(approvalId, input.customerId, input.assistantId, input.conversationId, input.requestedBy,
    input.kind, input.question, input.summary, input.proposedResponse || "", evidence, input.now, input.expiresAt, input.idempotencyKey, requestHash,
    input.conversationId, input.customerId, input.assistantId, input.customerId, input.assistantId).run();
  if (Number(result.meta?.changes || 0) > 0) return { id: approvalId, status: "pending", created: true };

  const raced = await db.prepare(
    "SELECT id,status,request_hash FROM human_approval_requests WHERE customer_id=? AND assistant_id=? AND idempotency_key=? LIMIT 1",
  ).bind(input.customerId, input.assistantId, input.idempotencyKey).first<any>();
  if (raced && String(raced.request_hash) !== requestHash) throw new Error("approval_idempotency_conflict");
  return raced ? { id: String(raced.id), status: String(raced.status), created: false } : null;
}

export async function decideHumanApproval(db: D1Database, input: {
  customerId: string; assistantId: string; approvalId: string; actorUserId: string;
  decision: ApprovalDecision; decisionText: string; now: number; telegramActorId?: string | null; destinationId?: string | null;
}) {
  const result = await db.batch([
    db.prepare(
      `UPDATE human_approval_requests SET status=?,decision_text=?,decided_by_user_id=?,decided_at=?,version=version+1
       WHERE id=? AND customer_id=? AND assistant_id=? AND status='pending' AND expires_at>?`,
    ).bind(input.decision, input.decisionText.slice(0, 2000), input.actorUserId, input.now,
      input.approvalId, input.customerId, input.assistantId, input.now),
    db.prepare(
      `INSERT INTO human_approval_audit
       (id,customer_id,assistant_id,approval_id,actor_user_id,action,decision_text,created_at,actor_telegram_user_id,destination_id)
       SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()>0`,
    ).bind(id(), input.customerId, input.assistantId, input.approvalId, input.actorUserId,
      input.decision, input.decisionText.slice(0, 2000), input.now, input.telegramActorId ?? null, input.destinationId ?? null),
  ]);
  return Number(result[0]?.meta?.changes || 0) > 0;
}

export async function recordHumanApprovalReply(db: D1Database, input: {
  customerId: string; assistantId: string; approvalId: string; captureId: string; destinationId: string;
  telegramUserId: string; actorUserId: string; replyText: string; conversationId: string;
  externalConversationId: string; businessConnectionId: string | null; replyJobId: string; auditId: string; now: number;
}) {
  const text = input.replyText.slice(0, 2000);
  const result = await db.batch([
    db.prepare(
      `UPDATE human_ops_reply_captures SET status='captured',captured_at=?
       WHERE id=? AND customer_id=? AND destination_id=? AND telegram_user_id=? AND status='pending' AND expires_at>?
         AND EXISTS (SELECT 1 FROM human_approval_requests WHERE id=? AND customer_id=? AND assistant_id=? AND status='pending' AND expires_at>?)
         AND EXISTS (SELECT 1 FROM customer_users cu JOIN users u ON u.id=cu.user_id
           WHERE cu.customer_id=? AND cu.user_id=? AND u.status='active' AND u.telegram_user_id=?
             AND (cu.role='owner' OR EXISTS (SELECT 1 FROM human_ops_actor_permissions p WHERE p.customer_id=cu.customer_id
               AND p.destination_id=? AND p.user_id=cu.user_id AND p.can_reply=1)))`,
    ).bind(input.now,input.captureId,input.customerId,input.destinationId,input.telegramUserId,input.now,input.approvalId,input.customerId,input.assistantId,input.now,
      input.customerId,input.actorUserId,input.telegramUserId,input.destinationId),
    db.prepare(
      `UPDATE human_approval_requests SET status='answered',decision_text=?,decided_by_user_id=?,decided_at=?,version=version+1
       WHERE id=? AND customer_id=? AND assistant_id=? AND status='pending' AND expires_at>?
         AND EXISTS (SELECT 1 FROM human_ops_reply_captures WHERE id=? AND status='captured' AND telegram_user_id=?)`,
    ).bind(text,input.actorUserId,input.now,input.approvalId,input.customerId,input.assistantId,input.now,input.captureId,input.telegramUserId),
    db.prepare(
      `INSERT INTO human_approval_audit
       (id,customer_id,assistant_id,approval_id,actor_user_id,action,decision_text,created_at,actor_telegram_user_id,destination_id)
       SELECT ?,?,?,?,?, 'answered',?,?,?,? WHERE changes()>0`,
    ).bind(input.auditId,input.customerId,input.assistantId,input.approvalId,input.actorUserId,text,input.now,input.telegramUserId,input.destinationId),
    db.prepare(
      `INSERT INTO reply_jobs
       (id,customer_id,assistant_id,conversation_id,channel,external_conversation_id,provider_message_id,sender_id,user_message_id,user_text,
        media_context,media_usage_json,image_count,audio_seconds,business_connection_id,status,due_at,attempts,max_attempts,last_enqueued_at,
        created_at,updated_at,response_text,delivery_role,human_approval_id)
       SELECT ?,?,?,?,?,?,?,?,?,'', '', '[]',0,0,?,'pending',?,0,20,NULL,?,?,?,?,?
       WHERE EXISTS (SELECT 1 FROM human_approval_audit WHERE id=? AND approval_id=? AND action='answered')`,
    ).bind(input.replyJobId,input.customerId,input.assistantId,input.conversationId,"telegram",input.externalConversationId,
      `human-approval:${input.approvalId}`,input.telegramUserId,`human:${input.actorUserId}`,input.businessConnectionId,input.now,input.now,input.now,text,"human",input.approvalId,input.auditId,input.approvalId),
  ]);
  return result.every((statement) => Number(statement.meta?.changes || 0) === 1);
}

export async function createHumanApprovalAction(db: D1Database, input: {
  token: string; customerId: string; approvalId: string; assistantId: string;
  deliveryAssistantId: string; userId: string; decision: "approved" | "rejected";
  expiresAt: number; now: number;
}) {
  const tokenHash = await hash(input.token);
  await db.prepare(
    `INSERT INTO human_approval_actions
     (token_hash,customer_id,approval_id,assistant_id,delivery_assistant_id,user_id,decision,expires_at,created_at)
     SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS
     (SELECT 1 FROM human_approval_requests WHERE id=? AND customer_id=? AND assistant_id=? AND status='pending')`,
  ).bind(tokenHash, input.customerId, input.approvalId, input.assistantId, input.deliveryAssistantId,
    input.userId, input.decision, input.expiresAt, input.now, input.approvalId, input.customerId, input.assistantId).run();
  return tokenHash;
}

export async function findHumanApprovalAction(db: D1Database, tokenHash: string, deliveryAssistantId: string, now: number) {
  return db.prepare(
    `SELECT x.customer_id,x.approval_id,x.assistant_id,x.user_id,x.decision,x.expires_at,
            r.status AS approval_status
     FROM human_approval_actions x JOIN human_approval_requests r
       ON r.id=x.approval_id AND r.customer_id=x.customer_id AND r.assistant_id=x.assistant_id
     WHERE x.token_hash=? AND x.delivery_assistant_id=? AND x.expires_at>? LIMIT 1`,
  ).bind(tokenHash, deliveryAssistantId, now).first<any>();
}
