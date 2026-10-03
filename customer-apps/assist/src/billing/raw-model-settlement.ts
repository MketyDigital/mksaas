/* eslint-disable @typescript-eslint/no-explicit-any */
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
const unix = () => Math.floor(Date.now() / 1000);

export type RawModelUsage = {
  modelAlias: string;
  provider: string;
  providerModel: string;
  conversationId: string;
  inputUnits: number;
  outputUnits: number;
  reasoningUnits?: number;
  requestedReasoningMode?: string;
  appliedReasoningMode?: string;
  providerCostMicros: number;
  providerAttemptId?: string;
  additionalProviderCosts?: Array<{
    provider: string; providerModel: string; inputUnits: number; outputUnits: number;
    reasoningUnits?: number; providerCostMicros: number; providerAttemptId: string;
  }>;
};

export async function reserveRawModelCredits(
  db: D1Database, customerId: string, apiKeyId: string, credits: number, idempotencyKey?: string,
) {
  const safeCredits = Math.max(1, Math.trunc(credits));
  if (idempotencyKey) {
    const existing = await db.prepare(
      "SELECT id,status,reserved_credits FROM raw_model_reservations WHERE customer_id=? AND api_key_id=? AND idempotency_key=? LIMIT 1",
    ).bind(customerId, apiKeyId, idempotencyKey).first<any>();
    if (existing) return { id: String(existing.id), status: String(existing.status), reservedCredits: Number(existing.reserved_credits) };
  }
  const reservationId = id("rres");
  const now = unix();
  const results = await db.batch([
    db.prepare("UPDATE credit_accounts SET balance=balance-?,updated_at=? WHERE customer_id=? AND balance>=?")
      .bind(safeCredits, now, customerId, safeCredits),
    db.prepare(
      `INSERT INTO raw_model_reservations (id,customer_id,api_key_id,reserved_credits,status,created_at,idempotency_key)
       SELECT ?,?,?,?,'open',?,? WHERE changes()>0`,
    ).bind(reservationId, customerId, apiKeyId, safeCredits, now, idempotencyKey ?? null),
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,assistant_id,workload_type,workload_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,NULL,'api_key',?,?,'inference_reserve',?,balance,? FROM credit_accounts
       WHERE customer_id=? AND EXISTS (SELECT 1 FROM raw_model_reservations WHERE id=?)`,
    ).bind(id("led"), customerId, apiKeyId, -safeCredits, reservationId, now, customerId, reservationId),
  ]);
  if (!Number(results[0]?.meta?.changes || 0)) {
    if (idempotencyKey) {
      const raced = await db.prepare(
        "SELECT id,status,reserved_credits FROM raw_model_reservations WHERE customer_id=? AND api_key_id=? AND idempotency_key=? LIMIT 1",
      ).bind(customerId, apiKeyId, idempotencyKey).first<any>();
      if (raced) return { id: String(raced.id), status: String(raced.status), reservedCredits: Number(raced.reserved_credits) };
    }
    return null;
  }
  return { id: reservationId, status: "open", reservedCredits: safeCredits };
}

export async function releaseRawModelCredits(db: D1Database, reservationId: string, customerId: string, apiKeyId: string) {
  const now = unix();
  const token = id("rrel");
  const results = await db.batch([
    db.prepare(
      "UPDATE raw_model_reservations SET status='released',settled_at=?,resolution_token=? WHERE id=? AND customer_id=? AND api_key_id=? AND status='open'",
    ).bind(now, token, reservationId, customerId, apiKeyId),
    db.prepare(
      `UPDATE credit_accounts SET balance=balance+(SELECT reserved_credits FROM raw_model_reservations WHERE id=?),updated_at=?
       WHERE customer_id=? AND EXISTS (SELECT 1 FROM raw_model_reservations WHERE id=? AND status='released' AND resolution_token=?)`,
    ).bind(reservationId, now, customerId, reservationId, token),
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,assistant_id,workload_type,workload_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,NULL,'api_key',?,(SELECT reserved_credits FROM raw_model_reservations WHERE id=?),'inference_release',?,balance,? FROM credit_accounts
       WHERE customer_id=? AND EXISTS (SELECT 1 FROM raw_model_reservations WHERE id=? AND status='released' AND resolution_token=?)`,
    ).bind(id("led"), customerId, apiKeyId, reservationId, reservationId, now, customerId, reservationId, token),
  ]);
  return Number(results[0]?.meta?.changes || 0) > 0;
}

export async function settleRawModelCredits(
  db: D1Database, reservationId: string, customerId: string, apiKeyId: string,
  reserved: number, actual: number, usage: RawModelUsage,
) {
  const safeActual = Math.max(0, Math.min(Math.trunc(reserved), Math.trunc(actual)));
  const now = unix();
  const claimToken = id("rstl");
  const settlementExists = "EXISTS(SELECT 1 FROM raw_model_settlements WHERE reservation_id=? AND claim_token=? AND status='applying')";
  const usageId = id("use");
  const attemptId = usage.providerAttemptId || `reservation:${reservationId}`;
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT OR IGNORE INTO raw_model_settlements (reservation_id,customer_id,api_key_id,claim_token,status,actual_credits,created_at)
       SELECT ?,?,?,?,'applying',?,? FROM raw_model_reservations
       WHERE id=? AND customer_id=? AND api_key_id=? AND status='open'`,
    ).bind(reservationId, customerId, apiKeyId, claimToken, safeActual, now, reservationId, customerId, apiKeyId),
    db.prepare(
      `UPDATE raw_model_reservations SET status='settled',settled_credits=?,settled_at=?,resolution_token=?
       WHERE id=? AND customer_id=? AND api_key_id=? AND status='open' AND ${settlementExists}`,
    ).bind(safeActual, now, claimToken, reservationId, customerId, apiKeyId, reservationId, claimToken),
    db.prepare(
      `UPDATE credit_accounts SET balance=balance+MAX(0,(SELECT reserved_credits FROM raw_model_reservations WHERE id=?)-?),
       lifetime_consumed=lifetime_consumed+?,updated_at=? WHERE customer_id=?
       AND EXISTS (SELECT 1 FROM raw_model_reservations WHERE id=? AND status='settled' AND resolution_token=?) AND ${settlementExists}`,
    ).bind(reservationId, safeActual, safeActual, now, customerId, reservationId, claimToken, reservationId, claimToken),
    db.prepare(
      `INSERT INTO usage_events
       (id,customer_id,assistant_id,workload_type,workload_id,api_key_id,conversation_id,model_alias,provider,provider_model,
        input_units,output_units,reasoning_units,requested_reasoning_mode,applied_reasoning_mode,credits_charged,provider_cost_micros,
        created_at,provider_attempt_id,reservation_id)
       SELECT ?,?,NULL,'api_key',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${settlementExists}`,
    ).bind(usageId, customerId, apiKeyId, apiKeyId, usage.conversationId, usage.modelAlias, usage.provider, usage.providerModel,
      usage.inputUnits, usage.outputUnits, usage.reasoningUnits ?? 0, usage.requestedReasoningMode ?? "standard",
      usage.appliedReasoningMode ?? "standard", safeActual, usage.providerCostMicros, now, attemptId, reservationId, reservationId, claimToken),
    db.prepare(
      `INSERT INTO provider_cost_events (id,customer_id,usage_event_id,provider,provider_model,cost_micros,currency,created_at,provider_attempt_id)
       SELECT ?,?,?,?,?,?,'USD',?,? WHERE ${settlementExists}`,
    ).bind(id("pce"), customerId, usageId, usage.provider, usage.providerModel, usage.providerCostMicros, now, attemptId, reservationId, claimToken),
  ];
  for (const extra of usage.additionalProviderCosts ?? []) {
    const extraUsageId = id("use");
    statements.push(
      db.prepare(
        `INSERT INTO usage_events
         (id,customer_id,assistant_id,workload_type,workload_id,api_key_id,conversation_id,model_alias,provider,provider_model,
          input_units,output_units,reasoning_units,requested_reasoning_mode,applied_reasoning_mode,credits_charged,provider_cost_micros,created_at,provider_attempt_id)
         SELECT ?,?,NULL,'api_key',?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${settlementExists}`,
      ).bind(extraUsageId, customerId, apiKeyId, apiKeyId, usage.conversationId, usage.modelAlias, extra.provider, extra.providerModel,
        extra.inputUnits, extra.outputUnits, extra.reasoningUnits ?? 0, usage.requestedReasoningMode ?? "standard",
        usage.appliedReasoningMode ?? "standard", 0, extra.providerCostMicros, now, extra.providerAttemptId, reservationId, claimToken),
      db.prepare(
        `INSERT INTO provider_cost_events (id,customer_id,usage_event_id,provider,provider_model,cost_micros,currency,created_at,provider_attempt_id)
         SELECT ?,?,?,?,?,?,'USD',?,? WHERE ${settlementExists}`,
      ).bind(id("pce"), customerId, extraUsageId, extra.provider, extra.providerModel, extra.providerCostMicros, now, extra.providerAttemptId, reservationId, claimToken),
    );
  }
  statements.push(
    db.prepare(
      `INSERT INTO credit_ledger (id,customer_id,assistant_id,workload_type,workload_id,delta,kind,reference_id,balance_after,created_at)
       SELECT ?,?,NULL,'api_key',?,?, 'inference_settlement_refund',?,balance,? FROM credit_accounts
       WHERE customer_id=? AND ${settlementExists}
         AND (SELECT reserved_credits FROM raw_model_reservations WHERE id=?)>?`,
    ).bind(id("led"), customerId, apiKeyId, Math.max(0, Math.trunc(reserved) - safeActual), reservationId, now,
      customerId, reservationId, claimToken, reservationId, safeActual),
    db.prepare("UPDATE raw_model_settlements SET status='applied',applied_at=? WHERE reservation_id=? AND claim_token=? AND status='applying'")
      .bind(now, reservationId, claimToken),
  );
  await db.batch(statements);
  const row = await db.prepare("SELECT status FROM raw_model_settlements WHERE reservation_id=? AND customer_id=? AND api_key_id=? LIMIT 1")
    .bind(reservationId, customerId, apiKeyId).first<any>();
  return row?.status === "applied";
}
