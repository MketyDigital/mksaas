export type ContextSnapshotKind = "published_prompt_tools" | "conversation_context" | "knowledge_retrieval";

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

type ContextKV = Pick<KVNamespace, "get" | "put">;
type OptionalContextKV = ContextKV | null | undefined;

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
  const maxTtl = input.kind === "published_prompt_tools" ? 900 : 300;
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
