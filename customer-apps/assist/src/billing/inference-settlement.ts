/* eslint-disable @typescript-eslint/no-explicit-any */
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
const unix = () => Math.floor(Date.now() / 1000);
const startOfMonthUnix = () => { const now = new Date(); return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000); };

export async function reserveInference(db: D1Database, customerId: string, assistantId: string, credits: number, idempotencyKey?: string) {
  if (idempotencyKey) {
    const existing = await db.prepare(
      "SELECT id,status,reserved_credits FROM credit_reservations WHERE customer_id=? AND idempotency_key=? LIMIT 1",
    ).bind(customerId, idempotencyKey).first<any>();
    if (existing) return { id: String(existing.id), status: String(existing.status), reservedCredits: Number(existing.reserved_credits || 0) };
  }
  const limit = await db.prepare("SELECT monthly_credit_cap FROM assistants WHERE id=? AND customer_id=?").bind(assistantId, customerId).first<any>();
  if (limit?.monthly_credit_cap) {
    const start = startOfMonthUnix();
    const used = await db.prepare(
      "SELECT COALESCE(SUM(credits_charged),0) AS used FROM usage_events WHERE customer_id=? AND assistant_id=? AND created_at>=?",
    ).bind(customerId, assistantId, start).first<any>();
    if (parseFloat(String(used?.used || 0)) + credits > parseFloat(String(limit.monthly_credit_cap))) return null;
  }
  const reservationId = id("res");
  const now = unix();
  const results = await db.batch([
    db.prepare("UPDATE credit_accounts SET balance=balance-?,updated_at=? WHERE customer_id=? AND balance>=?")
      .bind(credits, now, customerId, credits),
    db.prepare(
      `INSERT INTO credit_reservations (id,customer_id,assistant_id,reserved_credits,status,created_at,idempotency_key)
       SELECT ?,?,?,?,'open',?,? WHERE changes()>0`,
    ).bind(reservationId, customerId, assistantId, credits, now, idempotencyKey ?? null),
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,?,?,'inference_reserve',?,balance,? FROM credit_accounts
       WHERE customer_id=? AND EXISTS(SELECT 1 FROM credit_reservations WHERE id=?)`,
    ).bind(id("led"), customerId, assistantId, -credits, reservationId, now, customerId, reservationId),
  ]);
  if (!Number(results[0]?.meta?.changes || 0)) {
    if (idempotencyKey) {
      const raced = await db.prepare(
        "SELECT id,status,reserved_credits FROM credit_reservations WHERE customer_id=? AND idempotency_key=? LIMIT 1",
      ).bind(customerId, idempotencyKey).first<any>();
      if (raced) return { id: String(raced.id), status: String(raced.status), reservedCredits: Number(raced.reserved_credits || 0) };
    }
    return null;
  }
  return { id: reservationId, status: "open", reservedCredits: credits };
}

export async function releaseInferenceReservation(db: D1Database, reservationId: string, customerId: string, reserved: number) {
  const now = unix();
  const resolutionToken = id("rel");
  const results = await db.batch([
    db.prepare(
      "UPDATE credit_reservations SET status='released',settled_at=?,resolution_token=? WHERE id=? AND customer_id=? AND status='open'",
    ).bind(now, resolutionToken, reservationId, customerId),
    db.prepare(
      `UPDATE credit_accounts SET balance=balance+(SELECT reserved_credits FROM credit_reservations WHERE id=?),updated_at=?
       WHERE customer_id=? AND EXISTS(SELECT 1 FROM credit_reservations WHERE id=? AND status='released' AND resolution_token=?)`,
    ).bind(reservationId, now, customerId, reservationId, resolutionToken),
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,?, 'inference_release',?,balance,? FROM credit_accounts
       WHERE customer_id=? AND EXISTS(SELECT 1 FROM credit_reservations WHERE id=? AND status='released' AND resolution_token=?)`,
    ).bind(id("led"), customerId, Math.max(0, Math.trunc(reserved)), reservationId, now, customerId, reservationId, resolutionToken),
  ]);
  return Number(results[0]?.meta?.changes || 0) > 0;
}

export async function settleInference(
  db: D1Database,
  reservationId: string,
  customerId: string,
  assistantId: string,
  reserved: number,
  actual: number,
  usage: { modelAlias: string; provider: string; providerModel: string; conversationId: string; inputUnits: number; outputUnits: number; reasoningUnits?: number; requestedReasoningMode?: string; appliedReasoningMode?: string; providerCostMicros: number; providerAttemptId?: string; primaryCredits?: number; apiKeyId?: string | null; additionalProviderCosts?: Array<{ modelAlias: string; provider: string; providerModel: string; inputUnits: number; outputUnits: number; reasoningUnits?: number; requestedReasoningMode?: string; appliedReasoningMode?: string; costMicros: number; providerAttemptId?: string; creditsCharged?: number }> },
) {
  const now = unix();
  const safeActual = Math.max(0, Math.min(reserved, Math.trunc(actual)));
  const claimToken = id("stl");
  const settlementExists = `EXISTS(SELECT 1 FROM inference_settlements WHERE reservation_id=? AND claim_token=? AND status='applying')`;
  const usageId = id("use");
  const primaryAttemptId = usage.providerAttemptId || `reservation:${reservationId}`;
  let remainingCredits = safeActual;
  const primaryCreditsCharged = Math.min(remainingCredits, Math.max(0, Math.trunc(usage.primaryCredits ?? safeActual)));
  remainingCredits -= primaryCreditsCharged;
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT OR IGNORE INTO inference_settlements
       (reservation_id,customer_id,assistant_id,claim_token,status,actual_credits,created_at)
       SELECT ?,?,?,?,'applying',?,? FROM credit_reservations
       WHERE id=? AND customer_id=? AND assistant_id=? AND status='open'`,
    ).bind(reservationId, customerId, assistantId, claimToken, safeActual, now, reservationId, customerId, assistantId),
    db.prepare(
      `UPDATE credit_reservations SET status='settled',settled_credits=?,settled_at=?,resolution_token=?
       WHERE id=? AND customer_id=? AND assistant_id=? AND status='open' AND ${settlementExists}`,
    ).bind(safeActual, now, claimToken, reservationId, customerId, assistantId, reservationId, claimToken),
    db.prepare(
      `UPDATE credit_accounts
       SET balance=balance+MAX(0,(SELECT reserved_credits FROM credit_reservations WHERE id=?)-?),
           lifetime_consumed=lifetime_consumed+?,updated_at=?
      WHERE customer_id=? AND EXISTS(SELECT 1 FROM credit_reservations WHERE id=? AND status='settled' AND resolution_token=?)
         AND ${settlementExists}`,
    ).bind(reservationId, safeActual, safeActual, now, customerId, reservationId, claimToken, reservationId, claimToken),
    db.prepare(
      `INSERT INTO usage_events (id,customer_id,assistant_id,conversation_id,model_alias,provider,provider_model,input_units,output_units,reasoning_units,requested_reasoning_mode,applied_reasoning_mode,credits_charged,provider_cost_micros,created_at,api_key_id,reservation_id,provider_attempt_id)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${settlementExists}`,
    ).bind(usageId, customerId, assistantId, usage.conversationId, usage.modelAlias, usage.provider, usage.providerModel, usage.inputUnits, usage.outputUnits, usage.reasoningUnits ?? 0, usage.requestedReasoningMode ?? "standard", usage.appliedReasoningMode ?? "standard", primaryCreditsCharged, usage.providerCostMicros, now, usage.apiKeyId ?? null, reservationId, primaryAttemptId, reservationId, claimToken),
    db.prepare(
      `INSERT INTO provider_cost_events (id,customer_id,usage_event_id,provider,provider_model,cost_micros,currency,created_at,provider_attempt_id)
       SELECT ?,?,?,?,?,?,'USD',?,? WHERE ${settlementExists}`,
    ).bind(id("pce"), customerId, usageId, usage.provider, usage.providerModel, usage.providerCostMicros, now, primaryAttemptId, reservationId, claimToken),
  ];
  for (const extra of usage.additionalProviderCosts ?? []) {
    const extraUsageId = id("use");
    const extraAttemptId = extra.providerAttemptId || `extra:${reservationId}:${extraUsageId}`;
    const extraCreditsCharged = Math.min(remainingCredits, Math.max(0, Math.trunc(extra.creditsCharged || 0)));
    remainingCredits -= extraCreditsCharged;
    statements.push(
      db.prepare(
        `INSERT INTO usage_events (id,customer_id,assistant_id,conversation_id,model_alias,provider,provider_model,input_units,output_units,reasoning_units,requested_reasoning_mode,applied_reasoning_mode,credits_charged,provider_cost_micros,created_at,provider_attempt_id)
         SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${settlementExists}`,
      ).bind(extraUsageId, customerId, assistantId, usage.conversationId, extra.modelAlias, extra.provider, extra.providerModel, extra.inputUnits, extra.outputUnits, extra.reasoningUnits ?? 0, extra.requestedReasoningMode ?? "standard", extra.appliedReasoningMode ?? "standard", extraCreditsCharged, extra.costMicros, now, extraAttemptId, reservationId, claimToken),
      db.prepare(
        `INSERT INTO provider_cost_events (id,customer_id,usage_event_id,provider,provider_model,cost_micros,currency,created_at,provider_attempt_id)
         SELECT ?,?,?,?,?,?,'USD',?,? WHERE ${settlementExists}`,
      ).bind(id("pce"), customerId, extraUsageId, extra.provider, extra.providerModel, extra.costMicros, now, extraAttemptId, reservationId, claimToken),
    );
  }
  statements.push(
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,?,MAX(0,(SELECT reserved_credits FROM credit_reservations WHERE id=?)-?),'inference_settlement_refund',?,balance,?
       FROM credit_accounts WHERE customer_id=? AND ${settlementExists}
         AND (SELECT reserved_credits FROM credit_reservations WHERE id=?)>?`,
    ).bind(id("led"), customerId, assistantId, reservationId, safeActual, reservationId, now, customerId, reservationId, claimToken, reservationId, safeActual),
    db.prepare(
      `UPDATE inference_settlements SET status='applied',applied_at=? WHERE reservation_id=? AND claim_token=? AND status='applying'`,
    ).bind(now, reservationId, claimToken),
  );
  await db.batch(statements);
  const settlement = await db.prepare("SELECT status FROM inference_settlements WHERE reservation_id=? AND customer_id=? AND assistant_id=? LIMIT 1")
    .bind(reservationId, customerId, assistantId).first<any>();
  return settlement?.status === "applied";
}
