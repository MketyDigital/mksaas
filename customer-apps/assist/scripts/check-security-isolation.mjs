import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runtime, index, handoff] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/handoff/service.ts", import.meta.url), "utf8"),
]);
const contextCache = await readFile(new URL("../src/conversation/context-cache.ts", import.meta.url), "utf8");
const settlementJournal = await readFile(new URL("../src/billing/settlement-journal.ts", import.meta.url), "utf8");

for (const required of [
  "WHERE id=? AND customer_id=?",
  "customer_id=? AND assistant_id=?",
  "assistant.customer_id",
]) {
  assert.ok(runtime.includes(required) || index.includes(required) || handoff.includes(required), `missing scope guard: ${required}`);
}

assert.ok(!runtime.includes("WHERE assistant_id=? AND status='active' ORDER BY name LIMIT 12") || runtime.includes("assistant.id"));
assert.ok(handoff.includes("WHERE id=? AND customer_id=? AND assistant_id=?"));
assert.match(contextCache,/input\.customerId/);
assert.match(contextCache,/input\.assistantId/);
assert.match(contextCache,/input\.conversationId/);
assert.match(settlementJournal,/existing\.customerId !== identity\.customerId/);
assert.match(settlementJournal,/existing\.customerId !== identity\.customerId/);
assert.match(settlementJournal,/attemptScopeKey\(existing\) !== attemptScopeKey\(identity\)/);
assert.match(settlementJournal,/value\.workloadType === "api_key"/);
console.log("security isolation contract: ok");
