import { releaseInferenceReservation, settleInference } from "./inference-settlement.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
const unix = () => Math.floor(Date.now() / 1000);
const unresolvedStatuses = ["started", "unknown_outcome", "result_recorded"];

export type AttemptProjectionInput = {
  attemptId: string;
  customerId: string;
  assistantId: string;
  reservationId: string;
  requestHash: string;
  modelAlias: string;
  replyJobId?: string | null;
  conversationId?: string;
  mediaKind?: string | null;
  provider: string;
  model: string;
  rateSnapshot: Record<string, unknown>;
  requestedReasoningMode?: string;
  appliedReasoningMode?: string;
};

export async function recordAttemptProjection(db: D1Database, input: AttemptProjectionInput) {
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO inference_attempt_index
       (attempt_id,customer_id,assistant_id,reservation_id,request_hash,model_alias,reply_job_id,conversation_id,media_kind,
        provider,model,status,started_at,updated_at,rate_snapshot_json,requested_reasoning_mode,applied_reasoning_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'started',?,?,?,?,?)`,
    ).bind(
      input.attemptId,input.customerId,input.assistantId,input.reservationId,input.requestHash,input.modelAlias,
      input.replyJobId ?? null,input.conversationId || "",input.mediaKind ?? null,input.provider,input.model,
      unix(),unix(),JSON.stringify(input.rateSnapshot),input.requestedReasoningMode || "standard",input.appliedReasoningMode || "standard",
    ).run();
    await db.prepare(
      "UPDATE inference_attempt_index SET status='started',updated_at=? WHERE attempt_id=? AND customer_id=? AND assistant_id=? AND status='not_submitted'",
    ).bind(unix(), input.attemptId, input.customerId, input.assistantId).run();
    const existing = await db.prepare(
      "SELECT customer_id,assistant_id,reservation_id,request_hash FROM inference_attempt_index WHERE attempt_id=? LIMIT 1",
    ).bind(input.attemptId).first<any>();
    if (!existing || existing.customer_id !== input.customerId || existing.assistant_id !== input.assistantId ||
      existing.reservation_id !== input.reservationId || existing.request_hash !== input.requestHash) {
      throw new Error("attempt_projection_identity_conflict");
    }
  } catch (error) {
    throw new Error(`reconciliation_index_unavailable:${String(error instanceof Error ? error.message : error).slice(0, 180)}`);
  }
}

export async function updateAttemptProjection(db: D1Database, input: {
  attemptId: string; customerId: string; assistantId: string; status: string;
  provider?: string; model?: string; inputUnits?: number | null; outputUnits?: number | null;
  reasoningUnits?: number | null; providerCostMicros?: number | null; rateSnapshot?: Record<string, unknown>;
  imageUnits?: number | null; audioSeconds?: number | null;
  requestedReasoningMode?: string; appliedReasoningMode?: string; resolved?: boolean;
}) {
  if (!unresolvedStatuses.includes(input.status) && !["not_submitted", "settled"].includes(input.status)) throw new Error("invalid_attempt_projection_status");
  await db.prepare(
    `UPDATE inference_attempt_index SET status=?,provider=COALESCE(?,provider),model=COALESCE(?,model),
     input_units=COALESCE(?,input_units),output_units=COALESCE(?,output_units),reasoning_units=COALESCE(?,reasoning_units),
     image_units=COALESCE(?,image_units),audio_seconds=COALESCE(?,audio_seconds),
     provider_cost_micros=COALESCE(?,provider_cost_micros),rate_snapshot_json=COALESCE(?,rate_snapshot_json),
     requested_reasoning_mode=COALESCE(?,requested_reasoning_mode),applied_reasoning_mode=COALESCE(?,applied_reasoning_mode),
     resolved_at=CASE WHEN ? THEN ? ELSE resolved_at END,updated_at=?
     WHERE attempt_id=? AND customer_id=? AND assistant_id=?`,
  ).bind(
    input.status,input.provider ?? null,input.model ?? null,input.inputUnits ?? null,input.outputUnits ?? null,
    input.reasoningUnits ?? null,input.imageUnits ?? null,input.audioSeconds ?? null,input.providerCostMicros ?? null,input.rateSnapshot ? JSON.stringify(input.rateSnapshot) : null,
    input.requestedReasoningMode ?? null,input.appliedReasoningMode ?? null,input.resolved ? 1 : 0,unix(),unix(),
    input.attemptId,input.customerId,input.assistantId,
  ).run();
}

export async function listUnresolvedAttempts(db: D1Database, customerId: string, limit = 50, cursor?: number | null) {
  if (!String(customerId || "").trim()) throw new Error("attempt_customer_scope_required");
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 50)));
  const rows = await db.prepare(
    `SELECT attempt_id,customer_id,assistant_id,reservation_id,model_alias,reply_job_id,conversation_id,media_kind,
            provider,model,status,started_at,updated_at,input_units,output_units,reasoning_units,image_units,audio_seconds,provider_cost_micros,
            requested_reasoning_mode,applied_reasoning_mode,resolved_at
     FROM inference_attempt_index WHERE customer_id=? AND status IN ('started','unknown_outcome','result_recorded')
       AND (? IS NULL OR updated_at<?) ORDER BY updated_at DESC,attempt_id DESC LIMIT ?`,
  ).bind(customerId,cursor ?? null,cursor ?? null,safeLimit).all<any>();
  return (rows.results ?? []).map((row: any) => ({ ...row }));
}

type ResolutionInput = {
  attemptId: string;
  customerId: string;
  assistantId: string;
  operatorUserId: string;
  outcome: "confirmed_not_submitted" | "recovered_result" | "provider_charged_no_result" | "mkety_absorbed_cost" | "unresolved";
  idempotencyKey: string;
  evidenceSummary: string;
  reason: string;
  usage?: { inputUnits: number; outputUnits: number; reasoningUnits?: number; imageUnits?: number; audioSeconds?: number; providerCostMicros: number; evidence: string };
  absorbedProviderCost?: { providerCostMicros: number; evidence: string };
};

export async function resolveUnknownAttempt(db: D1Database, journal: any, input: ResolutionInput) {
  const { attemptId, customerId, assistantId, operatorUserId } = input;
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const reason = String(input.reason || "").trim().slice(0, 500);
  let evidenceSummary = String(input.evidenceSummary || "").trim().slice(0, 500);
  if (!idempotencyKey || idempotencyKey.length > 160 || !reason || !evidenceSummary) throw new Error("resolution_evidence_required");
  const row = await db.prepare(
    "SELECT * FROM inference_attempt_index WHERE attempt_id=? AND customer_id=? AND assistant_id=? LIMIT 1",
  ).bind(attemptId,customerId,assistantId).first<any>();
  if (!row) throw new Error("attempt_not_found_in_scope");
  const reservation = await db.prepare(
    "SELECT id,status,reserved_credits FROM credit_reservations WHERE id=? AND customer_id=? AND assistant_id=? LIMIT 1",
  ).bind(row.reservation_id,customerId,assistantId).first<any>();
  if (!reservation) throw new Error("attempt_reservation_not_found");
  const identity = { customerId, assistantId, attemptId };
  const journalAttempt = await journal.getAttempt(identity);
  if (!journalAttempt) throw new Error("journal_attempt_not_found");
  const previous = await db.prepare(
    "SELECT attempt_id,outcome FROM inference_attempt_resolution_audit WHERE idempotency_key=? LIMIT 1",
  ).bind(idempotencyKey).first<any>();
  if (previous) {
    if (String(previous.attempt_id) !== attemptId) throw new Error("resolution_idempotency_key_conflict");
    return {
      outcome: String(previous.outcome), idempotent: true, replyJobId: row.reply_job_id || null,
      recoveredText: previous.outcome === "recovered_result" ? String(journalAttempt.result?.responseText || "") : "",
    };
  }
  let resultOutcome = input.outcome;
  let released = false;
  let settled = false;
  let recoveredText = "";

  if (input.outcome === "confirmed_not_submitted") {
    if (["result_recorded", "settled"].includes(String(journalAttempt.status))) throw new Error("attempt_has_recoverable_result");
    await journal.resolveAttempt({ ...identity, outcome: "confirmed_not_submitted" });
    if (reservation.status === "open") {
      released = await releaseInferenceReservation(db, String(reservation.id), customerId, Number(reservation.reserved_credits || 0));
      if (!released) throw new Error("reservation_release_not_confirmed");
    } else if (reservation.status !== "released") throw new Error("reservation_already_settled");
    await updateAttemptProjection(db, { ...identity, status: "not_submitted", resolved: true });
  } else if (input.outcome === "unresolved") {
    if (!["started", "unknown_outcome"].includes(String(journalAttempt.status))) throw new Error("attempt_is_not_ambiguous");
    resultOutcome = "unresolved";
  } else if (input.outcome === "provider_charged_no_result") {
    const journalHasEmptyResult = journalAttempt.status === "result_recorded" &&
      Boolean(journalAttempt.result) && !String(journalAttempt.result?.responseText || "").trim();
    if (journalAttempt.status !== "unknown_outcome" && !journalHasEmptyResult) throw new Error("attempt_outcome_not_unknown");
    const usage = input.usage;
    if (!usage || !usage.evidence.trim() || !Number.isSafeInteger(usage.inputUnits) || usage.inputUnits < 0 ||
        !Number.isSafeInteger(usage.outputUnits) || usage.outputUnits < 0 ||
        !Number.isSafeInteger(usage.reasoningUnits ?? 0) || (usage.reasoningUnits ?? 0) < 0 ||
        !Number.isSafeInteger(usage.imageUnits ?? 0) || (usage.imageUnits ?? 0) < 0 ||
        !Number.isFinite(usage.audioSeconds ?? 0) || (usage.audioSeconds ?? 0) < 0 ||
        !Number.isSafeInteger(usage.providerCostMicros) || usage.providerCostMicros < 0 ||
        !hasBillableUsage(row.media_kind, usage)) {
      resultOutcome = "unresolved";
      evidenceSummary = "provider_cost_without_billable_usage";
    } else {
      if (journalHasEmptyResult && (
        Number(journalAttempt.result?.inputUnits || 0) !== usage.inputUnits ||
        Number(journalAttempt.result?.outputUnits || 0) !== usage.outputUnits ||
        Number(journalAttempt.result?.reasoningUnits || 0) !== Number(usage.reasoningUnits || 0) ||
        Number(journalAttempt.result?.providerCostMicros || 0) !== usage.providerCostMicros
      )) throw new Error("usage_evidence_conflicts_with_journal");
      const rate = parseRateSnapshot(row.rate_snapshot_json);
      const multiplierBps = Number(rate.rate_multiplier_bps || 10000);
      const economics = row.media_kind
        ? mediaAttemptEconomics(String(row.media_kind), usage, rate, multiplierBps)
        : attemptEconomics({ inputUnits: usage.inputUnits, outputUnits: usage.outputUnits, reasoningUnits: usage.reasoningUnits ?? 0, rate, multiplierBps });
      const actualCredits = Math.max(1, economics.credits);
      if (actualCredits > Number(reservation.reserved_credits || 0)) {
        resultOutcome = "unresolved";
        evidenceSummary = "evidenced_usage_exceeds_reserved_credits";
      } else {
        await claimResolutionUsage(db, identity, idempotencyKey, usage);
      }
      if (resultOutcome === "unresolved") {
        // The evidenced usage cannot be safely settled against this reservation.
      } else if (reservation.status === "settled") {
        const existingCost = await db.prepare(
          "SELECT p.cost_micros,u.input_units,u.output_units,u.reasoning_units,a.image_units,a.audio_seconds " +
          "FROM provider_cost_events p JOIN usage_events u ON u.id=p.usage_event_id " +
          "LEFT JOIN inference_attempt_index a ON a.attempt_id=p.provider_attempt_id " +
          "WHERE p.customer_id=? AND p.provider_attempt_id=? LIMIT 1",
        ).bind(customerId, attemptId).first<any>();
        if (!existingCost) throw new Error("reservation_already_settled_for_another_attempt");
        if (Number(existingCost.cost_micros) !== usage.providerCostMicros ||
            Number(existingCost.input_units) !== usage.inputUnits ||
            Number(existingCost.output_units) !== usage.outputUnits ||
            Number(existingCost.reasoning_units || 0) !== Number(usage.reasoningUnits || 0) ||
            Number(existingCost.image_units || 0) !== Number(usage.imageUnits || 0) ||
            Number(existingCost.audio_seconds || 0) !== Number(usage.audioSeconds || 0)) {
          throw new Error("resolution_evidence_conflicts_with_existing_settlement");
        }
        settled = true;
        await updateAttemptProjection(db, {
          ...identity, status: "settled", inputUnits: usage.inputUnits, outputUnits: usage.outputUnits,
          reasoningUnits: usage.reasoningUnits ?? 0, imageUnits: usage.imageUnits ?? null,
          audioSeconds: usage.audioSeconds ?? null, providerCostMicros: usage.providerCostMicros, resolved: true,
        });
      } else if (reservation.status !== "open") {
        throw new Error("reservation_already_resolved");
      } else {
        settled = await settleInference(db, String(reservation.id), customerId, assistantId,
          Number(reservation.reserved_credits || 0), actualCredits, {
            modelAlias: String(row.model_alias), provider: String(row.provider), providerModel: String(row.model),
            conversationId: String(row.conversation_id || `reconciliation:${attemptId}`), inputUnits: usage.inputUnits,
            outputUnits: usage.outputUnits, reasoningUnits: usage.reasoningUnits ?? 0,
            requestedReasoningMode: String(row.requested_reasoning_mode || "standard"),
            appliedReasoningMode: String(row.applied_reasoning_mode || "standard"),
            providerCostMicros: usage.providerCostMicros, providerAttemptId: attemptId, primaryCredits: actualCredits,
          });
        if (!settled) throw new Error("evidenced_provider_charge_settlement_failed");
        await updateAttemptProjection(db, {
          ...identity, status: "settled", inputUnits: usage.inputUnits, outputUnits: usage.outputUnits,
          reasoningUnits: usage.reasoningUnits ?? 0, imageUnits: usage.imageUnits ?? null,
          audioSeconds: usage.audioSeconds ?? null, providerCostMicros: usage.providerCostMicros, resolved: true,
        });
      }
      if (settled && journalHasEmptyResult && journalAttempt.status === "result_recorded") {
        await journal.markAttemptSettled({ ...identity, settlementId: String(reservation.id) });
      }
    }
  } else if (input.outcome === "mkety_absorbed_cost") {
    const cost = input.absorbedProviderCost;
    const journalHasEmptyResult = journalAttempt.status === "result_recorded" &&
      Boolean(journalAttempt.result) && !String(journalAttempt.result?.responseText || "").trim();
    if (journalAttempt.status !== "unknown_outcome" && !journalHasEmptyResult) throw new Error("attempt_outcome_not_unknown");
    if (!cost || !cost.evidence.trim() || !Number.isSafeInteger(cost.providerCostMicros) || cost.providerCostMicros <= 0) {
      throw new Error("exact_provider_cost_evidence_required");
    }
    if (journalHasEmptyResult && Number(journalAttempt.result?.providerCostMicros || 0) !== cost.providerCostMicros) {
      throw new Error("provider_cost_conflicts_with_journal");
    }
    await claimResolutionUsage(db, identity, idempotencyKey, {
      inputUnits: 0, outputUnits: 0, reasoningUnits: 0, imageUnits: 0, audioSeconds: 0,
      providerCostMicros: cost.providerCostMicros, evidence: cost.evidence,
    });
    if (reservation.status === "open") {
      settled = await settleInference(db, String(reservation.id), customerId, assistantId,
        Number(reservation.reserved_credits || 0), 0, {
          modelAlias: String(row.model_alias), provider: String(row.provider), providerModel: String(row.model),
          conversationId: String(row.conversation_id || `reconciliation:${attemptId}`),
          inputUnits: 0, outputUnits: 0, reasoningUnits: 0, providerCostMicros: cost.providerCostMicros,
          providerAttemptId: attemptId, primaryCredits: 0,
        });
      if (!settled) throw new Error("absorbed_provider_cost_recording_failed");
    } else if (reservation.status === "settled") {
      const prior = await db.prepare(
        "SELECT p.cost_micros,u.credits_charged FROM provider_cost_events p JOIN usage_events u ON u.id=p.usage_event_id WHERE p.customer_id=? AND p.provider_attempt_id=? LIMIT 1",
      ).bind(customerId, attemptId).first<any>();
      if (!prior || Number(prior.cost_micros) !== cost.providerCostMicros || Number(prior.credits_charged) !== 0) {
        throw new Error("reservation_already_settled_for_another_outcome");
      }
      settled = true;
    } else {
      throw new Error("reservation_already_resolved");
    }
    if (journalHasEmptyResult && journalAttempt.status === "result_recorded") {
      await journal.markAttemptSettled({ ...identity, settlementId: String(reservation.id) });
    }
    await updateAttemptProjection(db, {
      ...identity, status: "settled", inputUnits: 0, outputUnits: 0, reasoningUnits: 0,
      imageUnits: 0, audioSeconds: 0, providerCostMicros: cost.providerCostMicros, resolved: true,
    });
    resultOutcome = "mkety_absorbed_cost";
    evidenceSummary = `mkety_absorbed_exact_provider_cost:${cost.providerCostMicros}`;
  } else if (input.outcome === "recovered_result") {
    if (!["result_recorded", "settled"].includes(String(journalAttempt.status)) || !journalAttempt.result) throw new Error("journal_result_unavailable");
    const providerResult = journalAttempt.result;
    if (!String(providerResult.responseText || "").trim()) throw new Error("journal_result_empty");
    const metadata = providerResult.metadata || {};
    const rate = parseRateSnapshot(String(metadata.targetRateJson || row.rate_snapshot_json || "{}"));
    const requestedReasoningMode = String(metadata.requestedReasoningMode || row.requested_reasoning_mode || "standard");
    const appliedReasoningMode = String(metadata.appliedReasoningMode || row.applied_reasoning_mode || requestedReasoningMode);
    const priorAttempts = parsePriorAttempts(metadata.priorAttemptsJson);
    const priorEconomics = priorAttempts.map((attempt: any) => ({ attempt, ...attemptEconomics({
      inputUnits: Number(attempt.inputUnits || 0), outputUnits: Number(attempt.outputUnits || 0),
      reasoningUnits: Number(attempt.reasoningUnits || 0), rate: attempt.targetRate || {}, multiplierBps: Number(rate.rate_multiplier_bps || 10000),
    }) }));
    const credits = Number(providerResult.credits || 0) + priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0);
    if (credits > Number(reservation.reserved_credits || 0)) throw new Error("recovered_usage_exceeds_reserved_credits");
    if (reservation.status === "open") {
      settled = await settleInference(db, String(reservation.id), customerId, assistantId,
        Number(reservation.reserved_credits || 0), Math.max(1, credits), {
          modelAlias: String(row.model_alias), provider: String(metadata.provider || row.provider),
          providerModel: String(metadata.providerModel || row.model), conversationId: String(row.conversation_id || `reconciliation:${attemptId}`),
          inputUnits: providerResult.inputUnits, outputUnits: providerResult.outputUnits,
          reasoningUnits: Number(providerResult.reasoningUnits || metadata.reasoningUnits || 0),
          requestedReasoningMode, appliedReasoningMode, providerCostMicros: providerResult.providerCostMicros,
          providerAttemptId: attemptId, primaryCredits: Number(providerResult.credits || 0),
          additionalProviderCosts: priorEconomics.map((item: any) => ({
            modelAlias: String(row.model_alias), provider: String(item.attempt.provider), providerModel: String(item.attempt.providerModel),
            inputUnits: Number(item.attempt.inputUnits || 0), outputUnits: Number(item.attempt.outputUnits || 0),
            reasoningUnits: Number(item.attempt.reasoningUnits || 0),
            requestedReasoningMode: String(item.attempt.requestedReasoningMode || requestedReasoningMode),
            appliedReasoningMode: String(item.attempt.appliedReasoningMode || appliedReasoningMode),
            costMicros: item.providerCostMicros, providerAttemptId: String(item.attempt.providerAttemptId || ""), creditsCharged: item.credits,
          })),
        });
      if (!settled) throw new Error("recovered_result_settlement_failed");
    } else if (reservation.status !== "settled") throw new Error("reservation_not_settleable");
    recoveredText = providerResult.responseText;
    if (journalAttempt.status === "result_recorded") await journal.markAttemptSettled({ ...identity, settlementId: String(reservation.id) });
    await updateAttemptProjection(db, {
      ...identity, status: "settled", inputUnits: providerResult.inputUnits, outputUnits: providerResult.outputUnits,
      reasoningUnits: Number(providerResult.reasoningUnits || metadata.reasoningUnits || 0),
      providerCostMicros: providerResult.providerCostMicros, requestedReasoningMode, appliedReasoningMode, resolved: true,
    });
  } else {
    throw new Error("unsupported_resolution_outcome");
  }

  await db.prepare(
    `INSERT INTO inference_attempt_resolution_audit
     (id,attempt_id,idempotency_key,outcome,evidence_summary,reason,operator_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(id("ira"),attemptId,idempotencyKey,resultOutcome,evidenceSummary,reason,operatorUserId,unix()).run();
  return { outcome: resultOutcome, released, settled, recoveredText, replyJobId: row.reply_job_id || null, idempotent: false };
}

function parseRateSnapshot(value: unknown) {
  try { const parsed = JSON.parse(String(value || "{}")); return parsed && typeof parsed === "object" ? parsed : {}; }
  catch { return {}; }
}

function parsePriorAttempts(value: unknown) {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function hasBillableUsage(mediaKind: unknown, usage: NonNullable<ResolutionInput["usage"]>) {
  if (mediaKind === "speech") return Number(usage.audioSeconds || 0) > 0;
  if (mediaKind === "vision") return Number(usage.imageUnits || 0) > 0 ||
    usage.inputUnits + usage.outputUnits + (usage.reasoningUnits || 0) > 0;
  return usage.inputUnits + usage.outputUnits + (usage.reasoningUnits || 0) > 0;
}

function mediaAttemptEconomics(mediaKind: string, usage: NonNullable<ResolutionInput["usage"]>, rate: any, multiplierBps: number) {
  if (mediaKind === "speech") {
    const seconds = Number(usage.audioSeconds || 0);
    const creditsPerMinute = Math.ceil(Number(rate.audio_credits_per_minute || 0) * multiplierBps / 10000);
    return { credits: Math.max(1, Math.ceil(seconds / 60 * creditsPerMinute)) };
  }
  const imageUnits = Number(usage.imageUnits || 0);
  const inputRate = Math.ceil(Number(rate.input_credits_per_million || 0) * multiplierBps / 10000);
  const outputRate = Math.ceil(Number(rate.output_credits_per_million || 0) * multiplierBps / 10000);
  const reasoningRate = Math.ceil(Number(rate.reasoning_credits_per_million || 0) * multiplierBps / 10000);
  const imageRate = Math.ceil(Number(rate.image_credits || 0) * multiplierBps / 10000);
  return { credits: Math.max(1, imageUnits * imageRate + Math.ceil((
    usage.inputUnits * inputRate + usage.outputUnits * outputRate + (usage.reasoningUnits || 0) * reasoningRate
  ) / 1_000_000)) };
}

async function claimResolutionUsage(
  db: D1Database,
  identity: { attemptId: string; customerId: string; assistantId: string },
  idempotencyKey: string,
  usage: NonNullable<ResolutionInput["usage"]>,
) {
  const safeUsage = {
    inputUnits: usage.inputUnits, outputUnits: usage.outputUnits, reasoningUnits: usage.reasoningUnits || 0,
    imageUnits: usage.imageUnits || 0, audioSeconds: usage.audioSeconds || 0, providerCostMicros: usage.providerCostMicros,
  };
  const encoded = JSON.stringify(safeUsage);
  const result = await db.prepare(
    `UPDATE inference_attempt_index SET resolution_usage_json=?,resolution_idempotency_key=?
     WHERE attempt_id=? AND customer_id=? AND assistant_id=? AND resolution_usage_json IS NULL`,
  ).bind(encoded, idempotencyKey, identity.attemptId, identity.customerId, identity.assistantId).run();
  if (Number(result.meta?.changes || 0) > 0) return;
  const existing = await db.prepare(
    "SELECT resolution_usage_json FROM inference_attempt_index WHERE attempt_id=? AND customer_id=? AND assistant_id=? LIMIT 1",
  ).bind(identity.attemptId, identity.customerId, identity.assistantId).first<any>();
  if (String(existing?.resolution_usage_json || "") !== encoded) throw new Error("resolution_usage_conflict");
}

function attemptEconomics(input: { inputUnits: number; outputUnits: number; reasoningUnits: number; rate: any; multiplierBps: number }) {
  const rate = input.rate || {};
  const inputRate = Math.ceil(Number(rate.input_credits_per_million || 0) * input.multiplierBps / 10000);
  const outputRate = Math.ceil(Number(rate.output_credits_per_million || 0) * input.multiplierBps / 10000);
  const reasoningRate = rate.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(rate.reasoning_credits_per_million || 0) * input.multiplierBps / 10000);
  const credits = Math.ceil((input.inputUnits * inputRate + input.outputUnits * outputRate + input.reasoningUnits * reasoningRate) / 1_000_000);
  const providerCostMicros = Math.ceil((input.inputUnits * Number(rate.provider_input_cost_micros_per_million || 0)
    + input.outputUnits * Number(rate.provider_output_cost_micros_per_million || 0)
    + input.reasoningUnits * Number(rate.provider_reasoning_cost_micros_per_million || 0)) / 1_000_000);
  return { credits: providerCostMicros > 0 ? Math.max(1, credits) : credits, providerCostMicros };
}
