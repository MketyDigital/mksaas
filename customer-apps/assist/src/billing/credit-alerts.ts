export const CREDIT_ATOMS_PER_MKREDIT = 10_000;
export const CRITICAL_CREDIT_ALERT_MKREDITS = 2_000;

const criticalAtoms = CRITICAL_CREDIT_ALERT_MKREDITS * CREDIT_ATOMS_PER_MKREDIT;

export type CreditAlertLevel = "normal" | "soft" | "critical";

export function creditAlertProjection(balanceAtoms: number, monthlyAtoms: number) {
  const balance = Number.isFinite(balanceAtoms) ? Math.max(0, Math.trunc(balanceAtoms)) : 0;
  const monthly = Number.isFinite(monthlyAtoms) ? Math.max(0, Math.trunc(monthlyAtoms)) : 0;
  const softAtoms = Math.floor(monthly / 5);
  const hasSoftThreshold = softAtoms > criticalAtoms;
  const level: CreditAlertLevel = balance <= criticalAtoms
    ? "critical"
    : hasSoftThreshold && balance <= softAtoms
      ? "soft"
      : "normal";
  return {
    level,
    balanceMkredits: Math.round((balance / CREDIT_ATOMS_PER_MKREDIT) * 10_000) / 10_000,
    softThresholdMkredits: hasSoftThreshold
      ? Math.round((softAtoms / CREDIT_ATOMS_PER_MKREDIT) * 10_000) / 10_000
      : null,
    criticalThresholdMkredits: CRITICAL_CREDIT_ALERT_MKREDITS,
  };
}

export async function processOwnerCreditAlertOutbox(
  db: D1Database,
  deliver: (recipient: { userId: string; assistantId: string; telegramUserId: string }, alert: {
    customerId: string; level: "soft" | "critical"; balanceAtoms: number;
  }) => Promise<boolean>,
  now = Math.floor(Date.now() / 1000),
  batchSize = 20,
) {
  const events = await db.prepare(
    `SELECT id,customer_id,alert_level,balance_atoms FROM owner_credit_alert_outbox
     WHERE (status='pending' AND next_attempt_at<=?)
        OR (status='processing' AND lease_expires_at<=?)
     ORDER BY created_at,id LIMIT ?`,
  ).bind(now, now, Math.max(1, Math.min(50, Math.trunc(batchSize)))).all<any>();
  let processed = 0;
  for (const event of events.results ?? []) {
    const claimToken = crypto.randomUUID();
    const claim = await db.prepare(
      `UPDATE owner_credit_alert_outbox SET status='processing',claim_token=?,lease_expires_at=?,attempts=attempts+1
       WHERE id=? AND ((status='pending' AND next_attempt_at<=?) OR (status='processing' AND lease_expires_at<=?))`,
    ).bind(claimToken, now + 90, event.id, now, now).run();
    if (!Number(claim.meta?.changes || 0)) continue;

    const recipients = await db.prepare(
      `SELECT DISTINCT u.id AS user_id,u.telegram_user_id,u.telegram_recovery_assistant_id AS assistant_id
       FROM customer_users cu JOIN users u ON u.id=cu.user_id
       JOIN assistants da ON da.id=u.telegram_recovery_assistant_id AND da.customer_id=cu.customer_id AND da.status='active'
       JOIN assistant_channels dc ON dc.customer_id=cu.customer_id AND dc.assistant_id=da.id
         AND dc.channel='telegram' AND dc.status='active'
       LEFT JOIN owner_credit_alert_preferences p ON p.customer_id=cu.customer_id AND p.user_id=u.id
       WHERE cu.customer_id=? AND cu.role IN ('owner','admin') AND u.status='active'
         AND u.telegram_user_id IS NOT NULL AND COALESCE(p.enabled,1)=1`,
    ).bind(event.customer_id).all<any>();

    for (const recipient of recipients.results ?? []) {
      await db.prepare(
        `INSERT OR IGNORE INTO owner_credit_alert_deliveries
         (outbox_id,user_id,status,attempts,next_attempt_at,created_at)
         VALUES (?,?,'pending',0,?,?)`,
      ).bind(event.id, recipient.user_id, now, now).run();
    }

    await db.prepare(
      `UPDATE owner_credit_alert_deliveries SET status='skipped',last_error='owner_alert_recipient_unavailable'
       WHERE outbox_id=? AND status='pending' AND NOT EXISTS (
         SELECT 1 FROM customer_users cu JOIN users u ON u.id=cu.user_id
         JOIN assistants da ON da.id=u.telegram_recovery_assistant_id AND da.customer_id=cu.customer_id AND da.status='active'
         JOIN assistant_channels dc ON dc.customer_id=cu.customer_id AND dc.assistant_id=da.id
           AND dc.channel='telegram' AND dc.status='active'
         LEFT JOIN owner_credit_alert_preferences p ON p.customer_id=cu.customer_id AND p.user_id=u.id
         WHERE cu.customer_id=? AND cu.user_id=owner_credit_alert_deliveries.user_id
           AND cu.role IN ('owner','admin') AND u.status='active' AND u.telegram_user_id IS NOT NULL
           AND COALESCE(p.enabled,1)=1
       )`,
    ).bind(event.id, event.customer_id).run();

    const dueDeliveries = await db.prepare(
      `SELECT d.user_id,u.telegram_user_id,u.telegram_recovery_assistant_id AS assistant_id,d.attempts
       FROM owner_credit_alert_deliveries d JOIN users u ON u.id=d.user_id
       WHERE d.outbox_id=? AND d.status='pending' AND d.next_attempt_at<=?`,
    ).bind(event.id, now).all<any>();
    for (const recipient of dueDeliveries.results ?? []) {
      let sent = false;
      try {
        sent = await deliver({
          userId: String(recipient.user_id),
          assistantId: String(recipient.assistant_id),
          telegramUserId: String(recipient.telegram_user_id),
        }, {
          customerId: String(event.customer_id),
          level: event.alert_level === "critical" ? "critical" : "soft",
          balanceAtoms: Number(event.balance_atoms || 0),
        });
      } catch {
        sent = false;
      }
      const tries = Number(recipient.attempts || 0) + 1;
      const terminal = !sent && tries >= 8;
      const delay = Math.min(3600, 30 * (2 ** Math.min(tries - 1, 7)));
      await db.prepare(
        `UPDATE owner_credit_alert_deliveries
         SET status=?,attempts=?,next_attempt_at=?,sent_at=?,last_error=?
         WHERE outbox_id=? AND user_id=? AND status='pending'`,
      ).bind(sent ? "sent" : terminal ? "failed" : "pending", tries, now + delay,
        sent ? now : null, sent ? null : "telegram_delivery_failed", event.id, recipient.user_id).run();
    }

    await db.prepare(
      `UPDATE owner_credit_alert_outbox SET
         status=CASE WHEN NOT EXISTS (
           SELECT 1 FROM owner_credit_alert_deliveries WHERE outbox_id=? AND status='pending'
         ) THEN 'completed' ELSE 'pending' END,
         next_attempt_at=COALESCE((SELECT MIN(next_attempt_at) FROM owner_credit_alert_deliveries WHERE outbox_id=? AND status='pending'),?),
         completed_at=CASE WHEN NOT EXISTS (
           SELECT 1 FROM owner_credit_alert_deliveries WHERE outbox_id=? AND status='pending'
         ) THEN ? ELSE NULL END,
         lease_expires_at=NULL,claim_token=NULL
       WHERE id=? AND status='processing' AND claim_token=?`,
    ).bind(event.id, event.id, now + 60, event.id, now, event.id, claimToken).run();
    processed++;
  }
  return { processed };
}
