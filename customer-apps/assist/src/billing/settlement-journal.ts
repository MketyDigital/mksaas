export type AttemptStatus = "started" | "not_submitted" | "result_recorded" | "settled" | "unknown_outcome";

export type ProviderAttemptStarted = {
  customerId: string;
  assistantId: string;
  attemptId: string;
  reservationId: string;
  requestHash: string;
  provider: string;
  model: string;
  idempotencyKey: string;
  startedAt: number;
};

export type ProviderAttemptResult = {
  responseText: string;
  inputUnits: number;
  outputUnits: number;
  reasoningUnits?: number;
  providerCostMicros: number;
  credits: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type JournalAttempt = ProviderAttemptStarted & {
  status: AttemptStatus;
  result?: ProviderAttemptResult;
  settlementId?: string;
  updatedAt: number;
};

type JournalIdentity = Pick<ProviderAttemptStarted, "customerId" | "assistantId">;

export class SettlementJournal implements Rpc.DurableObjectBranded {
  declare [Rpc.__DURABLE_OBJECT_BRAND]: never;
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env?: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("not_found", { status: 404 });
    try {
      const payload = await request.json() as { method?: string; args?: unknown[] };
      const args = Array.isArray(payload.args) ? payload.args : [];
      let result: unknown;
      switch (String(payload.method || "")) {
        case "recordAttemptStarted":
          result = await this.recordAttemptStarted(args[0] as ProviderAttemptStarted);
          break;
        case "claimAttempt":
          result = await this.claimAttempt(args[0] as ProviderAttemptStarted);
          break;
        case "recordAttemptResult":
          result = await this.recordAttemptResult(args[0] as JournalIdentity & { attemptId: string }, args[1] as ProviderAttemptResult);
          break;
        case "markAttemptUnknown":
          result = await this.markAttemptUnknown(args[0] as JournalIdentity & { attemptId: string });
          break;
        case "markAttemptNotSubmitted":
          result = await this.markAttemptNotSubmitted(args[0] as JournalIdentity & { attemptId: string });
          break;
        case "getAttempt":
          result = await this.getAttempt(args[0] as JournalIdentity & { attemptId: string });
          break;
        case "resolveAttempt":
          result = await this.resolveAttempt(args[0] as JournalIdentity & { attemptId: string; outcome: "confirmed_not_submitted" });
          break;
        case "markAttemptSettled":
          result = await this.markAttemptSettled(args[0] as JournalIdentity & { attemptId: string; settlementId: string });
          break;
        default:
          return Response.json({ ok: false, error: "journal_method_not_found" }, { status: 404 });
      }
      return Response.json({ ok: true, result: result ?? null });
    } catch (error) {
      return Response.json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }

  async recordAttemptStarted(input: ProviderAttemptStarted): Promise<JournalAttempt> {
    const attempt = validateStarted(input);
    const key = `attempt:${attempt.attemptId}`;
    const existing = await this.state.storage.get<JournalAttempt>(key);
    if (existing) {
      assertIdentity(existing, attempt);
      if (existing.requestHash !== attempt.requestHash || existing.reservationId !== attempt.reservationId) {
        throw new Error("attempt_identity_conflict");
      }
      if (existing.status !== "not_submitted") return existing;
    }
    const value: JournalAttempt = { ...attempt, status: "started", updatedAt: Date.now() };
    await this.state.storage.put(key, value);
    return value;
  }

  async claimAttempt(input: ProviderAttemptStarted): Promise<{ attempt: JournalAttempt; claimed: boolean }> {
    const attempt = validateStarted(input);
    const key = `attempt:${attempt.attemptId}`;
    return this.state.storage.transaction(async (txn) => {
      const existing = await txn.get<JournalAttempt>(key);
      if (existing) {
        assertIdentity(existing, attempt);
        if (existing.requestHash !== attempt.requestHash || existing.reservationId !== attempt.reservationId) {
          throw new Error("attempt_identity_conflict");
        }
        if (existing.status !== "not_submitted") return { attempt: existing, claimed: false };
      }
      const value: JournalAttempt = { ...attempt, status: "started", updatedAt: Date.now() };
      await txn.put(key, value);
      return { attempt: value, claimed: true };
    });
  }

  async recordAttemptResult(identity: JournalIdentity & { attemptId: string }, result: ProviderAttemptResult): Promise<JournalAttempt> {
    const existing = await this.getAttempt(identity);
    if (!existing) throw new Error("attempt_not_started");
    if (existing.status === "unknown_outcome") throw new Error("attempt_outcome_unknown");
    if (existing.status === "settled") return existing;
    if (existing.status === "result_recorded") return existing;
    const safeResult = validateResult(result);
    const updated = { ...existing, result: safeResult, status: "result_recorded" as const, updatedAt: Date.now() };
    await this.state.storage.put(`attempt:${identity.attemptId}`, updated);
    return updated;
  }

  async markAttemptUnknown(identity: JournalIdentity & { attemptId: string }): Promise<JournalAttempt> {
    const existing = await this.getAttempt(identity);
    if (!existing) throw new Error("attempt_not_started");
    if (existing.status === "result_recorded" || existing.status === "settled") return existing;
    const updated = { ...existing, status: "unknown_outcome" as const, updatedAt: Date.now() };
    await this.state.storage.put(`attempt:${identity.attemptId}`, updated);
    return updated;
  }

  async markAttemptNotSubmitted(identity: JournalIdentity & { attemptId: string }): Promise<JournalAttempt> {
    const existing = await this.getAttempt(identity);
    if (!existing) throw new Error("attempt_not_started");
    if (existing.status !== "started") return existing;
    const updated = { ...existing, status: "not_submitted" as const, updatedAt: Date.now() };
    await this.state.storage.put(`attempt:${identity.attemptId}`, updated);
    return updated;
  }

  async getAttempt(identity: JournalIdentity & { attemptId: string }): Promise<JournalAttempt | null> {
    const existing = await this.state.storage.get<JournalAttempt>(`attempt:${identity.attemptId}`);
    if (!existing) return null;
    assertIdentity(existing, identity);
    return existing;
  }

  async resolveAttempt(identity: JournalIdentity & { attemptId: string; outcome: "confirmed_not_submitted" }): Promise<JournalAttempt> {
    return this.state.storage.transaction(async (txn) => {
      const existing = await txn.get<JournalAttempt>(`attempt:${identity.attemptId}`);
      if (!existing) throw new Error("attempt_not_started");
      assertIdentity(existing, identity);
      if (existing.status === "result_recorded" || existing.status === "settled") {
        throw new Error("attempt_has_recoverable_result");
      }
      if (existing.status === "not_submitted") return existing;
      if (existing.status !== "started" && existing.status !== "unknown_outcome") {
        throw new Error("attempt_cannot_be_resolved_as_not_submitted");
      }
      const updated = { ...existing, status: "not_submitted" as const, updatedAt: Date.now() };
      await txn.put(`attempt:${identity.attemptId}`, updated);
      return updated;
    });
  }

  async markAttemptSettled(identity: JournalIdentity & { attemptId: string; settlementId: string }): Promise<void> {
    const existing = await this.getAttempt(identity);
    if (!existing || existing.status !== "result_recorded" && existing.status !== "settled") {
      throw new Error("attempt_result_not_recorded");
    }
    if (existing.status === "settled" && existing.settlementId !== identity.settlementId) throw new Error("settlement_identity_conflict");
    await this.state.storage.put(`attempt:${identity.attemptId}`, {
      ...existing, status: "settled", settlementId: identity.settlementId, updatedAt: Date.now(),
    });
  }
}

function validateStarted(input: ProviderAttemptStarted): ProviderAttemptStarted {
  for (const value of [input.customerId, input.assistantId, input.attemptId, input.reservationId, input.requestHash, input.provider, input.model, input.idempotencyKey]) {
    if (!String(value || "").trim()) throw new Error("invalid_attempt_identity");
  }
  return { ...input, startedAt: Math.max(0, Math.trunc(input.startedAt)) };
}

function validateResult(result: ProviderAttemptResult): ProviderAttemptResult {
  if (!result || typeof result.responseText !== "string") throw new Error("invalid_attempt_result");
  return {
    responseText: result.responseText.slice(0, 100_000),
    inputUnits: Math.max(0, Math.trunc(Number(result.inputUnits) || 0)),
    outputUnits: Math.max(0, Math.trunc(Number(result.outputUnits) || 0)),
    reasoningUnits: Math.max(0, Math.trunc(Number(result.reasoningUnits) || 0)),
    providerCostMicros: Math.max(0, Math.trunc(Number(result.providerCostMicros) || 0)),
    credits: Math.max(0, Math.trunc(Number(result.credits) || 0)),
    ...(result.metadata ? { metadata: result.metadata } : {}),
  };
}

function assertIdentity(existing: JournalAttempt, identity: JournalIdentity) {
  if (existing.customerId !== identity.customerId || existing.assistantId !== identity.assistantId) {
    throw new Error("attempt_scope_mismatch");
  }
}

export function attemptIdFor(replyJobId: string, reservationId: string, ordinal: number): string {
  return `${replyJobId}:${reservationId}:${Math.max(0, Math.trunc(ordinal))}`;
}

type SettlementJournalClient = Pick<
  SettlementJournal,
  "recordAttemptStarted" | "claimAttempt" | "recordAttemptResult" | "markAttemptUnknown" |
  "markAttemptNotSubmitted" | "getAttempt" | "resolveAttempt" | "markAttemptSettled"
>;

export function settlementJournalStub(
  namespace: DurableObjectNamespace<SettlementJournal>,
  customerId: string,
  assistantId: string,
): SettlementJournalClient {
  const name = `${customerId}:${assistantId}`;
  const stub = namespace.get(namespace.idFromName(name));
  const call = async <T>(method: string, ...args: unknown[]): Promise<T> => {
    const response = await stub.fetch("https://settlement-journal.internal/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    const payload = await response.json() as { ok?: boolean; result?: T; error?: string };
    if (!response.ok || payload.ok !== true) throw new Error(String(payload.error || `settlement_journal_http_${response.status}`));
    return payload.result as T;
  };
  return {
    recordAttemptStarted: (input) => call("recordAttemptStarted", input),
    claimAttempt: (input) => call("claimAttempt", input),
    recordAttemptResult: (identity, result) => call("recordAttemptResult", identity, result),
    markAttemptUnknown: (identity) => call("markAttemptUnknown", identity),
    markAttemptNotSubmitted: (identity) => call("markAttemptNotSubmitted", identity),
    getAttempt: (identity) => call("getAttempt", identity),
    resolveAttempt: (identity) => call("resolveAttempt", identity),
    markAttemptSettled: (identity) => call("markAttemptSettled", identity),
  };
}
