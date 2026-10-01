/* eslint-disable @typescript-eslint/no-explicit-any */

const encoder = new TextEncoder();

export class RetryableInferenceError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number,
    public status?: number,
  ) {
    super(message);
    this.name = "RetryableInferenceError";
  }
}

export function classifyRetryableError(error: unknown) {
  if (error instanceof RetryableInferenceError) {
    return { retryable: true, retryAfterSeconds: clampRetry(error.retryAfterSeconds), message: error.message };
  }
  const message = String(error instanceof Error ? error.message : error || "");
  const lower = message.toLowerCase();
  const retryable =
    /\b429\b|too many requests|rate.?limit|overloaded|temporar|timeout|timed out|econnreset|connection reset|service unavailable|bad gateway|gateway timeout|\b502\b|\b503\b|\b504\b/.test(lower);
  return { retryable, retryAfterSeconds: retryable ? 5 : 0, message: message.slice(0, 500) };
}

export function providerHttpError(response: Response, payload: unknown) {
  const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
  const message = `Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`;
  if (response.status === 429 || response.status === 408 || response.status >= 500) {
    return new RetryableInferenceError(message, retryAfter || defaultBackoffForStatus(response.status), response.status);
  }
  return new Error(message);
}

export function computeHumanDelaySeconds(assistant: any, content: string) {
  if (!Number(assistant?.human_delay_enabled ?? 1)) return 0;
  const min = clampInt(assistant?.human_delay_min_seconds, 0, 3600, 3);
  const max = Math.max(min, clampInt(assistant?.human_delay_max_seconds, min, 3600, 12));
  const perCharMs = clampInt(assistant?.human_delay_per_char_ms, 0, 5000, 10);
  const readingSeconds = Math.floor(Math.min(300000, Math.max(0, content.length) * perCharMs) / 1000);
  const floor = Math.min(max, min + readingSeconds);
  if (max <= floor) return floor;
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff;
  return Math.round(floor + random * (max - floor));
}

export async function claimModelCapacity(
  db: D1Database,
  customerId: string,
  alias: string,
  estimatedTokens: number,
) {
  const customerScope = `customer:${customerId}:${alias}`;
  const globalScope = `global:${alias}`;
  const limit = await db.prepare(
    `SELECT * FROM model_runtime_limits
     WHERE (scope_key=? OR scope_key=?)
     ORDER BY CASE WHEN customer_id=? THEN 0 ELSE 1 END
     LIMIT 1`,
  ).bind(customerScope, globalScope, customerId).first<any>();
  if (!limit) return { allowed: true as const, scopeKey: customerScope };

  const rps = positiveNullable(limit.requests_per_second);
  const rpm = positiveNullable(limit.requests_per_minute);
  const tpm = positiveNullable(limit.tokens_per_minute);
  if (!rps && !rpm && !tpm) return { allowed: true as const, scopeKey: String(limit.scope_key) };

  const nowMs = Date.now();
  const secondBucket = Math.floor(nowMs / 1000);
  const minuteBucket = Math.floor(nowMs / 60000);
  const tokens = Math.max(1, Math.ceil(estimatedTokens));
  const scopeKey = String(limit.scope_key);
  const maxInt = 2147483647;
  const row = await db.prepare(
    `INSERT INTO model_rate_windows
       (scope_key,second_bucket,second_count,minute_bucket,minute_count,minute_tokens,updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(scope_key) DO UPDATE SET
       second_bucket=excluded.second_bucket,
       second_count=CASE WHEN model_rate_windows.second_bucket=excluded.second_bucket THEN model_rate_windows.second_count+1 ELSE 1 END,
       minute_bucket=excluded.minute_bucket,
       minute_count=CASE WHEN model_rate_windows.minute_bucket=excluded.minute_bucket THEN model_rate_windows.minute_count+1 ELSE 1 END,
       minute_tokens=CASE WHEN model_rate_windows.minute_bucket=excluded.minute_bucket THEN model_rate_windows.minute_tokens+excluded.minute_tokens ELSE excluded.minute_tokens END,
       updated_at=excluded.updated_at
     WHERE
       (CASE WHEN model_rate_windows.second_bucket=excluded.second_bucket THEN model_rate_windows.second_count+1 ELSE 1 END)<=?
       AND (CASE WHEN model_rate_windows.minute_bucket=excluded.minute_bucket THEN model_rate_windows.minute_count+1 ELSE 1 END)<=?
       AND (CASE WHEN model_rate_windows.minute_bucket=excluded.minute_bucket THEN model_rate_windows.minute_tokens+excluded.minute_tokens ELSE excluded.minute_tokens END)<=?
     RETURNING scope_key,second_count,minute_count,minute_tokens`,
  ).bind(
    scopeKey,
    secondBucket,
    1,
    minuteBucket,
    1,
    tokens,
    Math.floor(nowMs / 1000),
    rps || maxInt,
    rpm || maxInt,
    tpm || maxInt,
  ).first<any>();

  if (row) return { allowed: true as const, scopeKey };

  const base = clampInt(limit.retry_base_seconds, 1, 3600, 2);
  const max = clampInt(limit.retry_max_seconds, base, 86400, 120);
  const secondWait = rps ? 1 : 0;
  const minuteWait = rpm || tpm ? Math.max(1, 60 - (Math.floor(nowMs / 1000) % 60)) : 0;
  return {
    allowed: false as const,
    scopeKey,
    retryAfterSeconds: Math.min(max, Math.max(base, secondWait, minuteWait)),
  };
}

export function chunkKnowledge(text: string, maxChars = 2400, overlapChars = 240) {
  const clean = normalizeContextText(text);
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const para = clean.lastIndexOf("\n", end);
      const sentence = Math.max(clean.lastIndexOf(". ", end), clean.lastIndexOf("? ", end), clean.lastIndexOf("! ", end));
      const boundary = Math.max(para, sentence);
      if (boundary > start + Math.floor(maxChars * 0.55)) end = boundary + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlapChars);
  }
  return chunks.slice(0, 500);
}

export async function replaceKnowledgeChunks(input: {
  db: D1Database;
  customerId: string;
  collectionId: string;
  itemId: string;
  title: string;
  text: string;
}) {
  const chunks = chunkKnowledge(input.text);
  const old = await input.db.prepare("SELECT id FROM knowledge_chunks WHERE item_id=?").bind(input.itemId).all<any>();
  const statements: D1PreparedStatement[] = [];
  for (const row of old.results ?? []) {
    statements.push(input.db.prepare("DELETE FROM knowledge_chunks_fts WHERE chunk_id=?").bind(String(row.id)));
  }
  statements.push(input.db.prepare("DELETE FROM knowledge_chunks WHERE item_id=?").bind(input.itemId));
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `knch_${crypto.randomUUID().replace(/-/g, "")}`;
    const hash = await sha256Text(chunks[i]);
    statements.push(
      input.db.prepare(
        `INSERT INTO knowledge_chunks
         (id,customer_id,collection_id,item_id,ordinal,title,content,content_hash,char_count,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(chunkId,input.customerId,input.collectionId,input.itemId,i,input.title,chunks[i],hash,chunks[i].length,now,now),
    );
    statements.push(
      input.db.prepare("INSERT INTO knowledge_chunks_fts(chunk_id,title,content) VALUES (?,?,?)")
        .bind(chunkId,input.title,chunks[i]),
    );
  }
  for (let i = 0; i < statements.length; i += 80) {
    await input.db.batch(statements.slice(i, i + 80));
  }
  return chunks.length;
}

export async function deleteKnowledgeChunks(db: D1Database, itemIds: string[]) {
  if (!itemIds.length) return;
  for (const itemId of itemIds) {
    const rows = await db.prepare("SELECT id FROM knowledge_chunks WHERE item_id=?").bind(itemId).all<any>();
    const statements = (rows.results ?? []).map((row: any) =>
      db.prepare("DELETE FROM knowledge_chunks_fts WHERE chunk_id=?").bind(String(row.id))
    );
    statements.push(db.prepare("DELETE FROM knowledge_chunks WHERE item_id=?").bind(itemId));
    if (statements.length) await db.batch(statements);
  }
}

export async function getPromptCache(
  db: D1Database,
  cacheKey: string,
  sourceHash: string,
) {
  const row = await db.prepare(
    "SELECT value_text FROM prompt_cache WHERE cache_key=? AND source_hash=? AND expires_at>? LIMIT 1",
  ).bind(cacheKey, sourceHash, Math.floor(Date.now() / 1000)).first<any>();
  return row?.value_text ? String(row.value_text) : null;
}

export async function putPromptCache(input: {
  db: D1Database;
  cacheKey: string;
  customerId: string;
  assistantId: string;
  kind: string;
  value: string;
  sourceHash: string;
  ttlSeconds: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  await input.db.prepare(
    `INSERT INTO prompt_cache(cache_key,customer_id,assistant_id,kind,value_text,source_hash,expires_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(cache_key) DO UPDATE SET
       value_text=excluded.value_text,source_hash=excluded.source_hash,expires_at=excluded.expires_at,updated_at=excluded.updated_at`,
  ).bind(
    input.cacheKey,input.customerId,input.assistantId,input.kind,input.value,input.sourceHash,
    now + Math.max(1,input.ttlSeconds),now,now,
  ).run();
}

export function normalizeContextText(value: string) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function compactInstructions(value: string) {
  const normalized = normalizeContextText(value);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of normalized.split("\n")) {
    const line = raw.trim();
    if (!line) {
      if (out.at(-1) !== "") out.push("");
      continue;
    }
    const key = line.toLowerCase().replace(/\s+/g," ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g,"\n\n").trim();
}

export function mergeMemoryDigest(previous: string, messages: Array<{role: string;content: string}>, maxChars: number) {
  const lines = messages.map((m) => {
    const role = m.role === "assistant" ? "Assistant" : m.role === "human" ? "Human" : "User";
    const content = normalizeContextText(String(m.content || "")).slice(0, 480);
    return content ? `${role}: ${content}` : "";
  }).filter(Boolean);
  const combined = [normalizeContextText(previous), ...lines].filter(Boolean).join("\n");
  if (combined.length <= maxChars) return combined;
  const keepHead = Math.floor(maxChars * 0.35);
  const keepTail = maxChars - keepHead - 32;
  return combined.slice(0, keepHead).trimEnd() + "\n… older details compacted …\n" + combined.slice(-keepTail).trimStart();
}

export async function sha256Text(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseRetryAfter(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return clampRetry(Math.ceil(seconds));
  const at = Date.parse(value);
  if (Number.isFinite(at)) return clampRetry(Math.ceil((at - Date.now()) / 1000));
  return 0;
}

function defaultBackoffForStatus(status: number) {
  if (status === 429) return 10;
  if (status === 503) return 8;
  if (status === 502 || status === 504) return 5;
  return 3;
}

function clampRetry(value: number) {
  return Math.max(1, Math.min(86400, Math.ceil(Number(value) || 1)));
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function positiveNullable(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}
