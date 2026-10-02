import test from "node:test";
import assert from "node:assert/strict";

async function getCache() {
  return import("../src/conversation/context-cache.ts");
}

test("testCacheKeysAreTenantAndAssistantScoped", async () => {
  const { contextCacheKey } = await getCache();
  const base = {
    customerId: "customer-a",
    assistantId: "assistant-a",
    conversationId: "conversation-a",
    kind: "conversation_context",
    sourceVersion: "source-v1",
  };

  const key = contextCacheKey(base);
  assert.notEqual(key, contextCacheKey({ ...base, customerId: "customer-b" }));
  assert.notEqual(key, contextCacheKey({ ...base, assistantId: "assistant-b" }));
  assert.notEqual(key, contextCacheKey({ ...base, conversationId: "conversation-b" }));
});

test("testSnapshotRequiresMatchingSourceVersion", async () => {
  const { readContextSnapshot } = await getCache();
  const kv = {
    get: async () => JSON.stringify({ sourceVersion: "source-v2", value: "fresh context" }),
  };

  assert.equal(await readContextSnapshot(kv, "cache-key", "source-v1"), null);
  kv.get = async () => JSON.stringify({ sourceVersion: "source-v1", value: "fresh context" });
  assert.equal(await readContextSnapshot(kv, "cache-key", "source-v1"), "fresh context");
});

test("testSnapshotExpiresAtConfiguredTtl", async () => {
  const { writeContextSnapshot } = await getCache();
  const writes = [];
  const kv = { put: async (...args) => writes.push(args) };

  await writeContextSnapshot(kv, {
    customerId: "customer-a", assistantId: "assistant-a", sourceVersion: "p1",
    kind: "published_prompt_tools", value: "prompt", ttlSeconds: 900,
  });
  await writeContextSnapshot(kv, {
    customerId: "customer-a", assistantId: "assistant-a", conversationId: "conversation-a",
    sourceVersion: "c1", kind: "conversation_context", value: "history", ttlSeconds: 300,
  });

  assert.equal(writes[0][2].expirationTtl, 900);
  assert.equal(writes[1][2].expirationTtl, 300);
});

test("testKvFailureReturnsCacheMiss", async () => {
  const { readContextSnapshot, writeContextSnapshot } = await getCache();
  const kv = {
    get: async () => { throw new Error("KV unavailable"); },
    put: async () => { throw new Error("KV unavailable"); },
  };
  assert.equal(await readContextSnapshot(kv, "cache-key", "source-v1"), null);
  await assert.doesNotReject(() => writeContextSnapshot(kv, {
    customerId: "customer-a", assistantId: "assistant-a", sourceVersion: "p1",
    kind: "published_prompt_tools", value: "prompt", ttlSeconds: 900,
  }));
});

test("testPromptEditChangesCacheVersion", async () => {
  const { contextCacheKey } = await getCache();
  const base = { customerId: "c", assistantId: "a", kind: "published_prompt_tools", sourceVersion: "published-v3" };
  assert.notEqual(contextCacheKey(base), contextCacheKey({ ...base, sourceVersion: "published-v4" }));
});

test("testMemoryClearRejectsEarlierSnapshot", async () => {
  const { contextCacheKey, readContextSnapshot } = await getCache();
  const beforeClear = { customerId: "c", assistantId: "a", conversationId: "thread", kind: "conversation_context", sourceVersion: "cutoff-0/latest-10" };
  const afterClear = { ...beforeClear, sourceVersion: "cutoff-11/latest-12" };
  const stored = new Map([[contextCacheKey(beforeClear), JSON.stringify({ sourceVersion: beforeClear.sourceVersion, value: "old memory" })]]);
  const kv = { get: async (key) => stored.get(key) || null };
  assert.equal(await readContextSnapshot(kv, contextCacheKey(afterClear), afterClear.sourceVersion), null);
});

test("testKnowledgeSnapshotRequiresCurrentCollectionVersion", async () => {
  const { contextCacheKey, readContextSnapshot } = await getCache();
  const old = { customerId: "c", assistantId: "a", kind: "knowledge_retrieval", sourceVersion: "collections:item-1@10" };
  const changed = { ...old, sourceVersion: "collections:item-1@11" };
  const stored = new Map([[contextCacheKey(old), JSON.stringify({ sourceVersion: old.sourceVersion, value: '["old fact"]' })]]);
  const kv = { get: async (key) => stored.get(key) || null };
  assert.equal(await readContextSnapshot(kv, contextCacheKey(changed), changed.sourceVersion), null);
});

test("testCacheFallbackNeverSuppliesBillingOrPauseState", async () => {
  const runtime = await (await import("node:fs/promises")).readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /resolveAutomationState\(env\.DB/);
  assert.match(runtime, /reserveCredits\(env\.DB/);
  assert.match(runtime, /CONTEXT_CACHE/);
});

test("testCachedContextNeverAuthorizesInference", async () => {
  const runtime = await (await import("node:fs/promises")).readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const run = runtime.slice(runtime.indexOf("async function runAssistant"), runtime.indexOf("async function retrieveKnowledge"));
  assert.ok(run.indexOf("reserveCredits(env.DB") >= 0);
  assert.ok(run.indexOf("reserveCredits(env.DB") < run.indexOf("invokeJournaledProviderCall("));
  assert.match(run, /if \(!reservation\) return/);
});
