import postgres from 'postgres';

type Json = Record<string, unknown>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required acceptance setting: ' + name);
  return value;
}

function bigintValue(value: unknown, label: string) {
  try { return BigInt(String(value ?? '')); }
  catch { throw new Error(label + ' is not a valid bigint.'); }
}

async function responseJson(response: Response, label = 'Acceptance endpoint') {
  const text = await response.text();
  try {
    return JSON.parse(text) as Json;
  } catch {
    const diagnostic = text.replace(/\s+/g, ' ').trim().slice(0, 500);
    throw new Error(
      label + ' returned non-JSON HTTP ' + response.status +
      (diagnostic ? ': ' + JSON.stringify(diagnostic) : '.'),
    );
  }
}

const baseUrl = required('AI_ACCEPTANCE_BASE_URL').replace(/\/+$/, '');
const apiKey = required('AI_ACCEPTANCE_API_KEY');
const databaseUrl = required('AI_ACCEPTANCE_DATABASE_URL');
const model = process.env.AI_ACCEPTANCE_MODEL?.trim() || 'mkety-economy';
const projectId = process.env.AI_ACCEPTANCE_PROJECT_ID?.trim() || null;
const idempotencyKey = 'mkety-live-acceptance-' + Date.now() + '-' + crypto.randomUUID();

const body = {
  model,
  messages: [{ role: 'user', content: 'Reply only with: MKETY_ACCEPTANCE_OK' }],
  max_completion_tokens: 256,
};

const headers: Record<string, string> = {
  Authorization: 'Bearer ' + apiKey,
  'Content-Type': 'application/json',
  'Idempotency-Key': idempotencyKey,
};
if (projectId) headers['x-mkety-project-id'] = projectId;

const first = await fetch(baseUrl + '/api/v1/ai/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
const firstPayload = await responseJson(first);
if (!first.ok) {
  const error = firstPayload.error as Json | undefined;
  const code = String(error?.code ?? 'unknown_error');
  if (code === 'runtime_disabled') throw new Error('Non-production customer inference is still disabled. Enable only the prepared acceptance environment, never production.');
  throw new Error('Managed acceptance request failed: HTTP ' + first.status + ' ' + code);
}

const requestId = String(firstPayload.id ?? '');
if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error('Acceptance response did not return a request UUID.');
const choices = Array.isArray(firstPayload.choices) ? firstPayload.choices : [];
const firstChoice = choices[0] as Json | undefined;
const message = firstChoice?.message as Json | undefined;
const answer = String(message?.content ?? '').trim();
if (!/\bMKETY_ACCEPTANCE_OK\b/.test(answer)) throw new Error('Managed provider returned unexpected acceptance answer: ' + JSON.stringify(answer));

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const requestRows = await sql.unsafe("select id, tenant_id, project_id, api_key_id, idempotency_key, model_alias, provider_key, native_model, rate_card_id, rate_card_version, reserved_credits, settled_credits, status, input_tokens, cached_input_tokens, output_tokens, provider_cost_metadata, error_code, completed_at from saas_template.ai_requests where id = '" + requestId + "'::uuid");
  const request = requestRows[0];
  if (!request) throw new Error('Acceptance request was not persisted.');
  if (request.status !== 'completed' || request.error_code) throw new Error('Acceptance request is not completed cleanly: status=' + request.status + ' error=' + request.error_code);
  if (request.provider_key !== 'workers-ai') throw new Error('Unexpected managed provider: ' + request.provider_key);
  if (!request.rate_card_id || !request.rate_card_version) throw new Error('Immutable commercial rate-card snapshot was not recorded.');

  const reserved = bigintValue(request.reserved_credits, 'reserved_credits');
  const settled = bigintValue(request.settled_credits, 'settled_credits');
  const inputTokens = bigintValue(request.input_tokens, 'input_tokens');
  const outputTokens = bigintValue(request.output_tokens, 'output_tokens');
  if (reserved <= 0n || settled <= 0n || settled > reserved) throw new Error('Invalid commercial settlement: reserved=' + reserved + ' settled=' + settled);
  if (inputTokens <= 0n || outputTokens <= 0n) throw new Error('Provider usage was not normalized: input=' + inputTokens + ' output=' + outputTokens);

  const metadata = (request.provider_cost_metadata ?? {}) as Json;
  const actualCredits = bigintValue(metadata.actualCredits, 'providerCostMetadata.actualCredits');
  const providerCost = bigintValue(metadata.providerCostUsdMicros, 'providerCostMetadata.providerCostUsdMicros');
  const minimumRevenue = bigintValue(metadata.minimumRevenueUsdMicros, 'providerCostMetadata.minimumRevenueUsdMicros');
  if (actualCredits !== settled) throw new Error('Recorded actual credits do not match settled credits.');
  if (providerCost <= 0n || minimumRevenue <= 0n) throw new Error('Verified provider cost/minimum revenue evidence is missing.');
  if (!metadata.providerCostVerifiedAt) throw new Error('Provider cost verification date is missing.');

  const creditRows = await sql.unsafe("select status, reserved_credits, settled_credits, released_at, usage_event_id from saas_template.ai_credit_reservations where request_id = '" + requestId + "'::uuid");
  const creditReservation = creditRows[0];
  if (!creditReservation) throw new Error('Credit reservation was not persisted.');
  if (creditReservation.status !== 'settled' || creditReservation.released_at) throw new Error('Credit reservation did not settle cleanly: ' + creditReservation.status);
  if (bigintValue(creditReservation.settled_credits, 'credit reservation settled credits') !== settled) throw new Error('Credit reservation settlement does not match request settlement.');
  if (!creditReservation.usage_event_id) throw new Error('Settled credit reservation did not record a usage event.');

  const budgets = await sql.unsafe("select status, reserved_credits, settled_credits, reserved_requests, settled_requests from saas_template.ai_budget_reservations where request_id = '" + requestId + "'::uuid");
  for (const budget of budgets) {
    if (budget.status !== 'settled') throw new Error('Budget reservation did not settle: ' + budget.status);
    if (bigintValue(budget.settled_credits, 'budget settled credits') !== settled) throw new Error('Budget settlement does not match actual request credits.');
    if (bigintValue(budget.settled_requests, 'budget settled requests') !== 1n) throw new Error('Budget request settlement was not exactly one request.');
  }

  const rateRows = await sql.unsafe("select id, model_id, version, status, effective_from, effective_to from saas_template.ai_rate_cards where id = '" + String(request.rate_card_id) + "'::uuid");
  const rateCard = rateRows[0];
  if (!rateCard || Number(rateCard.version) !== Number(request.rate_card_version)) throw new Error('Recorded rate-card version no longer matches the immutable request snapshot.');

  const replay = await fetch(baseUrl + '/api/v1/ai/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
  const replayPayload = await responseJson(replay, 'Idempotent replay');
  if (replay.status !== 409 || String((replayPayload.error as Json | undefined)?.code ?? '') !== 'duplicate_request') throw new Error('Exact idempotent replay was not blocked as duplicate: HTTP ' + replay.status);

  const safeTenantId = String(request.tenant_id);
  if (!/^[0-9a-f-]{36}$/i.test(safeTenantId)) throw new Error('Persisted tenant id is invalid.');
  const countRows = await sql.unsafe("select count(*)::int as count from saas_template.ai_requests where tenant_id = '" + safeTenantId + "'::uuid and idempotency_key = '" + idempotencyKey.replace(/'/g, "''") + "'");
  if (Number(countRows[0]?.count) !== 1) throw new Error('Idempotent replay created more than one provider request record.');

  const conflictBody = { ...body, messages: [{ role: 'user', content: 'This body is intentionally different.' }] };
  const conflict = await fetch(baseUrl + '/api/v1/ai/chat/completions', { method: 'POST', headers, body: JSON.stringify(conflictBody) });
  const conflictPayload = await responseJson(conflict, 'Idempotency conflict probe');
  if (conflict.status !== 409 || String((conflictPayload.error as Json | undefined)?.code ?? '') !== 'idempotency_conflict') throw new Error('Changed-body idempotency conflict was not rejected.');

  console.log(JSON.stringify({ ok: true, requestId, modelAlias: request.model_alias, nativeModel: request.native_model, provider: request.provider_key, reservedCredits: reserved.toString(), settledCredits: settled.toString(), inputTokens: inputTokens.toString(), cachedInputTokens: String(request.cached_input_tokens), outputTokens: outputTokens.toString(), providerCostUsdMicros: providerCost.toString(), minimumRevenueUsdMicros: minimumRevenue.toString(), budgetReservations: budgets.length, idempotentReplay: 'blocked-without-redispatch' }, null, 2));
} finally {
  await sql.end();
}
