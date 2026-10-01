export type AutomationState = {
  paused: boolean;
  reason: "customer" | "assistant" | "conversation" | null;
};

export async function resolveAutomationState(
  db: D1Database,
  customerId: string,
  assistantId: string,
  conversationId: string,
): Promise<AutomationState> {
  const row = await db.prepare(
    `SELECT
       COALESCE((SELECT automation_paused FROM customers WHERE id=?),0) AS customer_paused,
       COALESCE((SELECT automation_paused FROM assistants WHERE id=? AND customer_id=?),0) AS assistant_paused,
       COALESCE((SELECT automation_paused FROM conversations WHERE id=? AND customer_id=? AND assistant_id=?),0) AS conversation_paused,
       (SELECT automation_resume_at FROM conversations WHERE id=? AND customer_id=? AND assistant_id=?) AS conversation_resume_at`,
  ).bind(customerId, assistantId, customerId, conversationId, customerId, assistantId, conversationId, customerId, assistantId).first<any>();
  if (Number(row?.customer_paused)) return { paused: true, reason: "customer" };
  if (Number(row?.assistant_paused)) return { paused: true, reason: "assistant" };
  if (Number(row?.conversation_paused)) {
    const resumeAt = row?.conversation_resume_at == null ? null : Number(row.conversation_resume_at);
    if (resumeAt && resumeAt <= Math.floor(Date.now() / 1000)) {
      await db.prepare(
        "UPDATE conversations SET automation_paused=0,automation_resume_at=NULL,automation_pause_reason=NULL,handoff_assignee_user_id=NULL,updated_at=unixepoch() WHERE id=? AND customer_id=? AND assistant_id=? AND automation_resume_at IS NOT NULL AND automation_resume_at<=unixepoch()",
      ).bind(conversationId, customerId, assistantId).run();
    } else {
      return { paused: true, reason: "conversation" };
    }
  }
  return { paused: false, reason: null };
}

export async function pauseCustomer(db: D1Database, customerId: string, paused: boolean) {
  await db.prepare("UPDATE customers SET automation_paused=?,updated_at=unixepoch() WHERE id=?").bind(paused ? 1 : 0, customerId).run();
}

export async function pauseAssistant(db: D1Database, customerId: string, assistantId: string, paused: boolean) {
  const r = await db.prepare("UPDATE assistants SET automation_paused=?,updated_at=unixepoch() WHERE id=? AND customer_id=?")
    .bind(paused ? 1 : 0, assistantId, customerId).run();
  if (!r.meta.changes) throw new Error("assistant_not_found");
}

export async function takeOverConversation(db: D1Database, customerId: string, assistantId: string, conversationId: string, userId?: string | null) {
  const r = await db.prepare(
    "UPDATE conversations SET automation_paused=1,automation_resume_at=NULL,automation_pause_reason='manual_takeover',handoff_assignee_user_id=?,updated_at=unixepoch() WHERE id=? AND customer_id=? AND assistant_id=?",
  ).bind(userId ?? null, conversationId, customerId, assistantId).run();
  if (!r.meta.changes) throw new Error("conversation_not_found");
}

export async function returnToAi(db: D1Database, customerId: string, assistantId: string, conversationId: string) {
  const r = await db.prepare(
    "UPDATE conversations SET automation_paused=0,automation_resume_at=NULL,automation_pause_reason=NULL,handoff_assignee_user_id=NULL,updated_at=unixepoch() WHERE id=? AND customer_id=? AND assistant_id=?",
  ).bind(conversationId, customerId, assistantId).run();
  if (!r.meta.changes) throw new Error("conversation_not_found");
}
