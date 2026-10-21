export type CreditActivityType = "all" | "usage" | "credits" | "payments";

export type CreditActivityFilters = {
  customerId: string | null;
  type: CreditActivityType;
  from: number | null;
  to: number | null;
  limit: number;
  offset: number;
};

const MAX_ACTIVITY_PAGE_SIZE = 100;
const MAX_ACTIVITY_OFFSET = 100_000;

function safeInteger(value: string | null): number | null {
  if (!value || !/^\d{1,12}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeCreditActivityFilters(params: URLSearchParams): CreditActivityFilters {
  const rawCustomerId = String(params.get("customerId") || "").trim();
  const type = params.get("type");
  const rawLimit = Number(params.get("limit") || 50);
  const rawOffset = Number(params.get("offset") || 0);
  const from = safeInteger(params.get("from"));
  let to = safeInteger(params.get("to"));
  if (from !== null && to !== null && to <= from) to = from;
  return {
    customerId: rawCustomerId && rawCustomerId !== "all" && rawCustomerId.length <= 128 ? rawCustomerId : null,
    type: type === "usage" || type === "credits" || type === "payments" ? type : "all",
    from,
    to,
    limit: Math.min(MAX_ACTIVITY_PAGE_SIZE, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50)),
    offset: Math.min(MAX_ACTIVITY_OFFSET, Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0)),
  };
}

type QueryInput = Pick<CreditActivityFilters, "customerId" | "type" | "from" | "to" | "limit" | "offset">;

function conditions(alias: string, filters: QueryInput): { sql: string; values: Array<string | number> } {
  const parts: string[] = [];
  const values: Array<string | number> = [];
  if (filters.customerId) { parts.push(`${alias}.customer_id=?`); values.push(filters.customerId); }
  if (filters.from !== null) { parts.push(`${alias}.created_at>=?`); values.push(filters.from); }
  if (filters.to !== null) { parts.push(`${alias}.created_at<?`); values.push(filters.to); }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

export function buildCreditActivityQuery(filters: QueryInput): { sql: string; values: Array<string | number> } {
  const streams: string[] = [];
  const values: Array<string | number> = [];
  // Any row outside each stream's newest offset + page-size rows cannot appear
  // in the globally ordered page. Bound the union inputs before sorting them.
  const candidateLimit = filters.offset + filters.limit;

  if (filters.type === "all" || filters.type === "credits") {
    const where = conditions("l", filters);
    streams.push(`SELECT * FROM (SELECT 'credit' AS record_type,l.id,l.customer_id,c.name AS customer_name,
      l.assistant_id,a.name AS assistant_name,l.kind AS event_type,l.delta AS amount,
      l.balance_after,l.reference_id,l.metadata_json,
      NULL AS input_units,NULL AS output_units,NULL AS reasoning_units,
      NULL AS requested_reasoning_mode,NULL AS applied_reasoning_mode,
      NULL AS model_alias,NULL AS provider,NULL AS provider_model,NULL AS provider_cost_micros,
      l.workload_type,l.workload_id,NULL AS payment_status,NULL AS payment_provider,
      NULL AS purchase_type,NULL AS payment_amount_minor,NULL AS payment_currency,
      NULL AS provider_payment_id,NULL AS provider_pay_currency,NULL AS provider_actual_paid_fiat_minor,l.created_at
      FROM credit_ledger l
      JOIN customers c ON c.id=l.customer_id
      LEFT JOIN assistants a ON a.id=l.assistant_id
      ${where.sql}${where.sql ? " AND" : " WHERE"} l.kind NOT IN ('topup','plan_funding')
      ORDER BY l.created_at DESC,l.id DESC LIMIT ?)`);
    values.push(...where.values, candidateLimit);
  }

  if (filters.type === "all" || filters.type === "usage") {
    const where = conditions("u", filters);
    streams.push(`SELECT * FROM (SELECT 'usage' AS record_type,u.id,u.customer_id,c.name AS customer_name,
      u.assistant_id,a.name AS assistant_name,'inference_usage' AS event_type,-u.credits_charged AS amount,
      NULL AS balance_after,COALESCE(u.reservation_id,u.provider_attempt_id) AS reference_id,NULL AS metadata_json,
      u.input_units,u.output_units,u.reasoning_units,u.requested_reasoning_mode,u.applied_reasoning_mode,
      u.model_alias,u.provider,u.provider_model,
      COALESCE((SELECT SUM(pc.cost_micros) FROM provider_cost_events pc WHERE pc.usage_event_id=u.id),u.provider_cost_micros,0) AS provider_cost_micros,
      u.workload_type,COALESCE(u.workload_id,u.api_key_id) AS workload_id,
      NULL AS payment_status,NULL AS payment_provider,NULL AS purchase_type,
      NULL AS payment_amount_minor,NULL AS payment_currency,
      NULL AS provider_payment_id,NULL AS provider_pay_currency,NULL AS provider_actual_paid_fiat_minor,u.created_at
      FROM usage_events u
      JOIN customers c ON c.id=u.customer_id
      LEFT JOIN assistants a ON a.id=u.assistant_id
      ${where.sql}
      ORDER BY u.created_at DESC,u.id DESC LIMIT ?)`);
    values.push(...where.values, candidateLimit);
  }

  if (filters.type === "all" || filters.type === "payments") {
    const where = conditions("p", filters);
    streams.push(`SELECT * FROM (SELECT 'payment' AS record_type,p.id,p.customer_id,c.name AS customer_name,
      NULL AS assistant_id,NULL AS assistant_name,p.purchase_type AS event_type,p.credits AS amount,
      l.balance_after,p.reference AS reference_id,NULL AS metadata_json,
      NULL AS input_units,NULL AS output_units,NULL AS reasoning_units,
      NULL AS requested_reasoning_mode,NULL AS applied_reasoning_mode,
      NULL AS model_alias,NULL AS provider,NULL AS provider_model,NULL AS provider_cost_micros,
      NULL AS workload_type,NULL AS workload_id,p.status AS payment_status,p.provider AS payment_provider,
      p.purchase_type,p.canonical_amount_minor AS payment_amount_minor,p.canonical_currency AS payment_currency,
      p.provider_payment_id,p.provider_pay_currency,p.provider_actual_paid_fiat_minor,p.created_at
      FROM payment_checkouts p
      JOIN customers c ON c.id=p.customer_id
      LEFT JOIN credit_ledger l ON l.customer_id=p.customer_id AND l.reference_id=p.id AND l.kind IN ('topup','plan_funding')
      ${where.sql}
      ORDER BY p.created_at DESC,p.id DESC LIMIT ?)`);
    values.push(...where.values, candidateLimit);
  }

  return {
    sql: `SELECT * FROM (${streams.join(" UNION ALL ")}) activity ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
    values: [...values, filters.limit, filters.offset],
  };
}
