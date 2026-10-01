import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [runtime, index, handoff] = await Promise.all([
  readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/handoff/service.ts", import.meta.url), "utf8"),
]);

for (const required of [
  "WHERE id=? AND customer_id=?",
  "customer_id=? AND assistant_id=?",
  "assistant.customer_id",
]) {
  assert.ok(runtime.includes(required) || index.includes(required) || handoff.includes(required), `missing scope guard: ${required}`);
}

assert.ok(!runtime.includes("WHERE assistant_id=? AND status='active' ORDER BY name LIMIT 12") || runtime.includes("assistant.id"));
assert.ok(handoff.includes("WHERE id=? AND customer_id=? AND assistant_id=?"));
console.log("security isolation contract: ok");
