export async function recordAssistantVersion(
  db: D1Database,
  customerId: string,
  assistantId: string,
  userId: string | null,
) {
  const assistant = await db.prepare(
    "SELECT name,status,model_alias,timezone,memory_enabled,monthly_credit_cap,automation_paused,current_version FROM assistants WHERE id=? AND customer_id=? AND deleted_at IS NULL LIMIT 1",
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
        automationPaused: Boolean(assistant.automation_paused),
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
    `UPDATE assistants SET name=?,status=?,model_alias=?,timezone=?,memory_enabled=?,monthly_credit_cap=?,automation_paused=?,updated_at=unixepoch()
     WHERE id=? AND customer_id=? AND deleted_at IS NULL`,
  ).bind(
    String(cfg.name || "Assistant"),
    ["active","paused","disabled"].includes(cfg.status) ? cfg.status : "paused",
    String(cfg.modelAlias || "mkety-smart"),
    String(cfg.timezone || "UTC"),
    cfg.memoryEnabled === false ? 0 : 1,
    cfg.monthlyCreditCap == null ? null : Number(cfg.monthlyCreditCap),
    cfg.automationPaused ? 1 : 0,
    assistantId,
    customerId,
  ).run();
  return recordAssistantVersion(db, customerId, assistantId, userId);
}
