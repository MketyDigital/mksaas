import assert from "node:assert/strict";
import test from "node:test";
import { promptCacheKey, seedPublishedPrompts } from "./seed-published-prompts.mjs";

test("prompt cache keys include tenant and assistant identity", () => {
  const key = promptCacheKey("customer:a", "assistant/1");
  assert.equal(key, "mkety-assist:context:v1:customer%3Aa:assistant%2F1:published_prompt_snapshot:_:published-prompt-snapshot-v1");
});

test("seeding stores prompt snapshots without returning or logging prompt text", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "POST") return new Response(JSON.stringify({
      success: true,
      result: [{ results: [{ customer_id: "c1", assistant_id: "a1", version: 4, instructions: "private policy text" }] }],
    }), { status: 200 });
    return new Response("{}", { status: 200 });
  };
  const result = await seedPublishedPrompts({ accountId: "acct", databaseId: "db", namespaceId: "kv", token: "secret", fetchImpl });
  assert.deepEqual(result, { seeded: 1 });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /expiration_ttl=86400$/);
  const stored = JSON.parse(calls[1].init.body);
  assert.equal(stored.sourceVersion, "published-prompt-snapshot-v1");
  assert.deepEqual(JSON.parse(stored.value), { version: 4, instructions: "private policy text" });
  assert.equal(JSON.stringify(result).includes("private policy text"), false);
});
