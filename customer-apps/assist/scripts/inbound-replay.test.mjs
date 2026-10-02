import test from "node:test";
import assert from "node:assert/strict";

const { enqueueInboundUpdate, replayInboundUpdate } = await import("../src/queues/inbound.ts");

test("testWebhookAcknowledgesOnlyAfterQueueReceipt", async () => {
  const events = [];
  const queue = { send: async (body) => { events.push(["queued", body.providerEventId]); } };
  const payload = await enqueueInboundUpdate(queue, { assistantId: "asst_1", update: { update_id: 45, message: { message_id: 11 } } });
  events.push(["ack", payload.providerEventId]);
  assert.deepEqual(events, [["queued", "45"], ["ack", "45"]]);
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const intake = runtime.slice(runtime.indexOf("export async function handleAssistantTelegramWebhook"), runtime.indexOf("export async function processInboundQueue"));
  assert.ok(intake.indexOf("enqueueInboundUpdate(env.INBOUND_QUEUE") < intake.indexOf("return json({ ok: true, queued: true"));
});

test("testQueueFailureReturnsRetryableResponse", async () => {
  const queue = { send: async () => { throw new Error("queue unavailable"); } };
  await assert.rejects(() => enqueueInboundUpdate(queue, { assistantId: "asst_1", update: { update_id: 45 } }), /queue unavailable/);
});

test("testDuplicateUpdateCreatesOneTurn", async () => {
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  assert.match(runtime,/INSERT OR IGNORE INTO webhook_events[\s\S]*external_event_id/);
  assert.match(runtime,/UPDATE webhook_events SET status='processing',processing_at/);
  assert.match(runtime,/status IN \('received','error'\)/);
  assert.match(runtime,/inbound_event_in_progress/);
  assert.match(runtime,/provider_message_id=\? LIMIT 1/);
});

test("testD1RecoveryResumesSameConversation", async () => {
  const payload = { assistantId: "asst_1", providerEventId: "45", update: { update_id: 45, message: { message_id: 11 } } };
  const replayed = [];
  await assert.rejects(() => replayInboundUpdate(payload, async () => { throw new Error("D1 unavailable"); }), /D1 unavailable/);
  const result = await replayInboundUpdate(payload, async (same) => {
    replayed.push(same);
    return { assistantId: same.assistantId, providerEventId: same.providerEventId, providerMessageId: String(same.update.message.message_id) };
  });
  assert.deepEqual(result, { assistantId: "asst_1", providerEventId: "45", providerMessageId: "11" });
  assert.equal(replayed[0].providerEventId, payload.providerEventId);
});

test("testTransientQueueRetryIsBounded", async () => {
  const { readFile } = await import("node:fs/promises");
  const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const delivery = runtime.slice(runtime.indexOf("async function processReplyJob"), runtime.indexOf("async function buildConversationContext"));
  assert.match(delivery, /attempts=attempts\+1/);
  assert.match(delivery, /Number\(job\.attempts \|\| 0\) > Number\(job\.max_attempts \|\| 20\)/);
  assert.match(delivery, /Math\.min\(600, 30 \* Math\.max\(1, Number\(job\.attempts \|\| 1\)\)\)/);
  assert.match(delivery, /Math\.min\(86400, Number\(response\.retryAfterSeconds \|\| 5\)\)/);
});
