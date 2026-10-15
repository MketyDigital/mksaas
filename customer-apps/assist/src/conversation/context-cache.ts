export type ContextSnapshotKind = "published_prompt_tools" | "published_prompt_snapshot" | "conversation_context" | "knowledge_retrieval";

export type CacheIdentity = {
  customerId: string;
  assistantId: string;
  conversationId?: string;
  sourceVersion: string;
  kind: ContextSnapshotKind;
};

export type CacheWrite = CacheIdentity & {
  value: string;
  ttlSeconds: number;
};

type ContextKV = Pick<KVNamespace, "get" | "put"> & Partial<Pick<KVNamespace, "delete">>;
type OptionalContextKV = ContextKV | null | undefined;

const PUBLISHED_PROMPT_SNAPSHOT_VERSION = "published-prompt-snapshot-v1";
const PUBLISHED_PROMPT_SNAPSHOT_TTL_SECONDS = 86400;

function keyPart(value: string): string {
  return encodeURIComponent(String(value || "").trim());
}

export function contextCacheKey(input: CacheIdentity): string {
  const conversation = input.conversationId ? keyPart(input.conversationId) : "_";
  return [
    "mkety-assist",
    "context",
    "v1",
    keyPart(input.customerId),
    keyPart(input.assistantId),
    keyPart(input.kind),
    conversation,
    keyPart(input.sourceVersion),
  ].join(":");
}

export async function readContextSnapshot(
  kv: OptionalContextKV,
  key: string,
  sourceVersion: string,
): Promise<string | null> {
  if (!kv) return null;
  try {
    const serialized = await kv.get(key);
    if (!serialized) return null;
    const snapshot = JSON.parse(serialized) as { sourceVersion?: unknown; value?: unknown };
    if (snapshot.sourceVersion !== sourceVersion || typeof snapshot.value !== "string") return null;
    return snapshot.value;
  } catch {
    return null;
  }
}

export async function writeContextSnapshot(kv: OptionalContextKV, input: CacheWrite): Promise<void> {
  if (!kv) return;
  const maxTtl = input.kind === "published_prompt_tools" ? 900
    : input.kind === "published_prompt_snapshot" ? PUBLISHED_PROMPT_SNAPSHOT_TTL_SECONDS : 300;
  const requestedTtl = Number(input.ttlSeconds);
  const expirationTtl = Number.isFinite(requestedTtl)
    ? Math.max(1, Math.min(maxTtl, Math.floor(requestedTtl)))
    : maxTtl;
  try {
    await kv.put(
      contextCacheKey(input),
      JSON.stringify({ sourceVersion: input.sourceVersion, value: input.value }),
      { expirationTtl },
    );
  } catch {
    // KV is an optional cache; callers must continue through the D1 path.
  }
}

export function publishedPromptSnapshotKey(customerId: string, assistantId: string): string {
  return contextCacheKey({
    customerId,
    assistantId,
    kind: "published_prompt_snapshot",
    sourceVersion: PUBLISHED_PROMPT_SNAPSHOT_VERSION,
  });
}

export async function readPublishedPromptSnapshot(
  kv: OptionalContextKV,
  customerId: string,
  assistantId: string,
): Promise<{ version: number; instructions: string } | null> {
  const serialized = await readContextSnapshot(
    kv,
    publishedPromptSnapshotKey(customerId, assistantId),
    PUBLISHED_PROMPT_SNAPSHOT_VERSION,
  );
  if (!serialized) return null;
  try {
    const prompt = JSON.parse(serialized);
    const version = Number(prompt?.version);
    if (!Number.isInteger(version) || version < 1 || typeof prompt?.instructions !== "string") return null;
    return { version, instructions: prompt.instructions };
  } catch {
    return null;
  }
}

export async function writePublishedPromptSnapshot(
  kv: OptionalContextKV,
  customerId: string,
  assistantId: string,
  version: number,
  instructions: string,
): Promise<void> {
  if (!kv) return;
  const key = publishedPromptSnapshotKey(customerId, assistantId);
  try {
    await kv.put(key, JSON.stringify({
      sourceVersion: PUBLISHED_PROMPT_SNAPSHOT_VERSION,
      value: JSON.stringify({ version, instructions }),
    }), { expirationTtl: PUBLISHED_PROMPT_SNAPSHOT_TTL_SECONDS });
  } catch {
    // A failed refresh must not leave an older business prompt available as fallback.
    try { await kv.delete?.(key); } catch { /* KV is an optional cache. */ }
  }
}

export async function loadPublishedPromptSnapshot(
  kv: OptionalContextKV,
  customerId: string,
  assistantId: string,
  loadFromD1: () => Promise<{ version: number; instructions: string } | null>,
  d1TimeoutMs = 1500,
): Promise<{ version: number; instructions: string } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = Symbol("published-prompt-d1-timeout");
  try {
    const prompt = await Promise.race([
      loadFromD1(),
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), Math.max(1, d1TimeoutMs));
      }),
    ]);
    if (prompt === timedOut) return readPublishedPromptSnapshot(kv, customerId, assistantId);
    if (!prompt) return null;
    await writePublishedPromptSnapshot(kv, customerId, assistantId, prompt.version, prompt.instructions);
    return prompt;
  } catch {
    return readPublishedPromptSnapshot(kv, customerId, assistantId);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
