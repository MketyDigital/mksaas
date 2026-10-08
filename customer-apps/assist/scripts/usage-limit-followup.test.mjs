import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import { prepareUsageLimitFollowup } from "../src/handoff/usage-limit-followup.ts";

test("usage limit tells the customer a real team follow-up is coming only after handoff is recorded and notified", async () => {
  const calls = [];
  const reply = await prepareUsageLimitFollowup({ customerId: "cus_1", assistantId: "asst_1", conversationId: "con_1" }, {
    ensureOpenHandoff: async (item) => { calls.push(["handoff", item]); return true; },
    notifyOwners: async (item) => { calls.push(["notify", item]); },
  });

  assert.equal(reply, "Sorry about that. I’m tied up right now, but our team will check this conversation and get back to you here as soon as they can.");
  assert.deepEqual(calls.map(([name]) => name), ["handoff", "notify"]);
});

test("usage limit does not promise human follow-up when the handoff cannot be saved", async () => {
  const reply = await prepareUsageLimitFollowup({ customerId: "cus_1", assistantId: "asst_1", conversationId: "con_1" }, {
    ensureOpenHandoff: async () => false,
    notifyOwners: async () => assert.fail("owners must not be notified without a recorded handoff"),
  });

  assert.equal(reply, "Sorry, I can’t help with that properly right now.");
});


test("Telegram reply processing routes both budget and credit exhaustion through durable human handoff", async () => {
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");
  const providerCostGate = runtime.indexOf('if (commercial.hard_stop_enabled && !(await providerBudgetAllows(');
  const creditGate = runtime.indexOf('if (!reservation) return await usageLimitResponse(env, assistant, conversationId, "available_credits");');
  assert.notEqual(providerCostGate, -1);
  assert.match(runtime.slice(providerCostGate, providerCostGate + 600), /usageLimitResponse\(env, assistant, conversationId, "monthly_provider_budget"\)/);
  assert.notEqual(creditGate, -1);
  assert.match(runtime, /prepareUsageLimitFollowup\(identity, \{/);
  assert.match(runtime, /ensureOpenHandoff: async \(item\)/);
  assert.match(runtime, /notifyOwners: async \(item\) => notifyLinkedOwners/);
  assert.match(ui, /data-target-input="'\+i\+'" readonly/);
  assert.match(ui, /data-target-output="'\+i\+'" readonly/);
  assert.match(ui, /data-target-image="'\+i\+'" readonly/);
  assert.match(ui, /data-target-audio="'\+i\+'" readonly/);
});
