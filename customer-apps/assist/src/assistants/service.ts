export type AssistantReasoningMode = "standard" | "high" | "maximum";
export type AssistantReasoningFallbackPolicy = "allow_lower_effort" | "strict";

export function normalizeReasoningMode(value: unknown): AssistantReasoningMode | null {
  return value === "standard" || value === "high" || value === "maximum" ? value : null;
}

export function normalizeReasoningFallbackPolicy(value: unknown): AssistantReasoningFallbackPolicy | null {
  return value === "allow_lower_effort" || value === "strict" ? value : null;
}

export async function recordAssistantVersion(
  db: D1Database,
  customerId: string,
  assistantId: string,
  userId: string | null,
) {
  const assistant = await db.prepare(
    "SELECT name,status,model_alias,timezone,memory_enabled,monthly_credit_cap,automation_paused,reasoning_mode,reasoning_fallback_policy,current_version,human_delay_enabled,human_delay_min_seconds,human_delay_max_seconds,human_delay_per_char_ms,context_recent_message_limit,context_knowledge_char_budget,context_memory_char_budget FROM assistants WHERE id=? AND customer_id=? AND deleted_at IS NULL LIMIT 1",
  ).bind(assistantId, customerId).first<any>();
  if (!assistant) throw new Error("assistant_not_found");
  const next = Math.max(1, Number(assistant.current_version || 0) + 1);
  await db.batch([
    db.prepare(
      "INSERT INTO assistant_config_versions (id,customer_id,assistant_id,version,config_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,unixepoch())",
    ).bind(
      `asv_${crypto.randomUUID().replace(/-/g, "")}`,
      customerId,
      assistantId,
      next,
      JSON.stringify({
        name: assistant.name,
        status: assistant.status,
        modelAlias: assistant.model_alias,
        timezone: assistant.timezone,
        memoryEnabled: Boolean(assistant.memory_enabled),
        monthlyCreditCap: assistant.monthly_credit_cap,
        reasoningMode: assistant.reasoning_mode || "standard",
        reasoningFallbackPolicy: assistant.reasoning_fallback_policy || "allow_lower_effort",
        automationPaused: Boolean(assistant.automation_paused),
        humanDelayEnabled: Boolean(assistant.human_delay_enabled),
        humanDelayMinSeconds: assistant.human_delay_min_seconds,
        humanDelayMaxSeconds: assistant.human_delay_max_seconds,
        humanDelayPerCharMs: assistant.human_delay_per_char_ms,
        contextRecentMessageLimit: assistant.context_recent_message_limit,
        contextKnowledgeCharBudget: assistant.context_knowledge_char_budget,
        contextMemoryCharBudget: assistant.context_memory_char_budget,
      }),
      userId,
    ),
    db.prepare("UPDATE assistants SET current_version=?,updated_at=unixepoch() WHERE id=? AND customer_id=?")
      .bind(next, assistantId, customerId),
  ]);
  return next;
}

export async function archiveAssistant(db: D1Database, customerId: string, assistantId: string) {
  const r = await db.prepare(
    "UPDATE assistants SET status='disabled',archived_at=COALESCE(archived_at,unixepoch()),updated_at=unixepoch() WHERE id=? AND customer_id=? AND deleted_at IS NULL",
  ).bind(assistantId, customerId).run();
  if (!r.meta.changes) throw new Error("assistant_not_found");
}

export async function restoreAssistant(db: D1Database, customerId: string, assistantId: string) {
  const r = await db.prepare(
    "UPDATE assistants SET status='paused',archived_at=NULL,updated_at=unixepoch() WHERE id=? AND customer_id=? AND deleted_at IS NULL",
  ).bind(assistantId, customerId).run();
  if (!r.meta.changes) throw new Error("assistant_not_found");
}

export async function deleteAssistant(db: D1Database, customerId: string, assistantId: string) {
  const row = await db.prepare(
    `SELECT archived_at,
       (SELECT COUNT(*) FROM credit_reservations WHERE customer_id=? AND assistant_id=? AND status='open') AS open_reservations
     FROM assistants WHERE id=? AND customer_id=? AND deleted_at IS NULL LIMIT 1`,
  ).bind(customerId, assistantId, assistantId, customerId).first<any>();
  if (!row) throw new Error("assistant_not_found");
  if (!row.archived_at) throw new Error("assistant_must_be_archived_first");
  if (Number(row.open_reservations || 0) > 0) throw new Error("assistant_has_open_reservations");
  const r = await db.prepare(
    "UPDATE assistants SET deleted_at=unixepoch(),status='disabled',updated_at=unixepoch() WHERE id=? AND customer_id=? AND deleted_at IS NULL",
  ).bind(assistantId, customerId).run();
  if (!r.meta.changes) throw new Error("assistant_not_found");
}

export async function listAssistantVersions(db: D1Database, customerId: string, assistantId: string) {
  const rows = await db.prepare(
    "SELECT id,version,config_json,created_by_user_id,created_at FROM assistant_config_versions WHERE customer_id=? AND assistant_id=? ORDER BY version DESC",
  ).bind(customerId, assistantId).all();
  return rows.results ?? [];
}

export async function rollbackAssistantVersion(
  db: D1Database,
  customerId: string,
  assistantId: string,
  version: number,
  userId: string | null,
) {
  const row = await db.prepare(
    "SELECT config_json FROM assistant_config_versions WHERE customer_id=? AND assistant_id=? AND version=? LIMIT 1",
  ).bind(customerId, assistantId, version).first<any>();
  if (!row) throw new Error("assistant_version_not_found");
  const cfg = JSON.parse(row.config_json || "{}");
  await db.prepare(
    `UPDATE assistants SET name=?,status=?,model_alias=?,timezone=?,memory_enabled=?,monthly_credit_cap=?,automation_paused=?,
       reasoning_mode=?,reasoning_fallback_policy=?,
       human_delay_enabled=?,human_delay_min_seconds=?,human_delay_max_seconds=?,human_delay_per_char_ms=?,
       context_recent_message_limit=?,context_knowledge_char_budget=?,context_memory_char_budget=?,updated_at=unixepoch()
     WHERE id=? AND customer_id=? AND deleted_at IS NULL`,
  ).bind(
    String(cfg.name || "Assistant"),
    ["active","paused","disabled"].includes(cfg.status) ? cfg.status : "paused",
    String(cfg.modelAlias || "mkety-smart"),
    String(cfg.timezone || "UTC"),
    cfg.memoryEnabled === false ? 0 : 1,
    cfg.monthlyCreditCap == null ? null : Number(cfg.monthlyCreditCap),
    cfg.automationPaused ? 1 : 0,
    normalizeReasoningMode(cfg.reasoningMode) || "standard",
    normalizeReasoningFallbackPolicy(cfg.reasoningFallbackPolicy) || "allow_lower_effort",
    cfg.humanDelayEnabled === false ? 0 : 1,
    Number(cfg.humanDelayMinSeconds ?? 3),
    Number(cfg.humanDelayMaxSeconds ?? 12),
    Number(cfg.humanDelayPerCharMs ?? 10),
    Number(cfg.contextRecentMessageLimit ?? 12),
    Number(cfg.contextKnowledgeCharBudget ?? 12000),
    Number(cfg.contextMemoryCharBudget ?? 4000),
    assistantId,
    customerId,
  ).run();
  return recordAssistantVersion(db, customerId, assistantId, userId);
}
