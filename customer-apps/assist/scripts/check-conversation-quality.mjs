import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const acceptanceFile = process.env.ASSIST_ACCEPTANCE_FILE;
assert.ok(acceptanceFile, "ASSIST_ACCEPTANCE_FILE must point to the inference acceptance JSON");
const payload = JSON.parse(await readFile(acceptanceFile, "utf8"));
const quality = payload?.conversationQuality;
assert.ok(quality && quality.ok === true, "synthetic conversation quality probe failed");
assert.equal(quality.costRatesAvailable, true, "probe cost rates are unavailable");
assert.ok(Array.isArray(quality.cases) && quality.cases.length >= 4, "quality probe returned incomplete case results");
for (const item of quality.cases) {
  console.log(`Conversation quality ${item.name}: ${item.ok ? "PASS" : "FAIL"} — ${item.detail}`);
  assert.equal(item.ok, true, `quality case failed: ${item.name}`);
}
assert.ok(Number.isFinite(Number(quality.providerCostMicros)) && Number(quality.providerCostMicros) >= 0, "probe cost estimate is invalid");
console.log(`Conversation quality provider cost estimate: ${quality.providerCostMicros} micros (${quality.model})`);
