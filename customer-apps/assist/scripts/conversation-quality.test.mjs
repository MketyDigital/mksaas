import test from "node:test";
import assert from "node:assert/strict";
import {
  BAD_MEDICAL_ADVICE_REPLY,
  BAD_PROMPT_ECHO_REPLY,
  BAD_UNSUPPORTED_FACT_REPLY,
  GOOD_SYNTHETIC_REPLIES,
} from "./conversation-quality-fixtures.mjs";

async function runProbe(replies = GOOD_SYNTHETIC_REPLIES, beforeGenerate = () => {}) {
  const { runConversationQualityProbe } = await import("../src/conversation/quality-probe.ts");
  let call = 0;
  const result = await runConversationQualityProbe({
    generate: async (messages) => {
      beforeGenerate(messages, call);
      return replies[call++] || { text: "", providerCostMicros: 0 };
    },
  });
  return { result, calls: call };
}

test("testFollowUpUsesEarlierNameAndQuestion", async () => {
  const { result } = await runProbe(GOOD_SYNTHETIC_REPLIES, (messages, call) => {
    if (call === 1) {
      const history = messages.map((message) => message.content).join("\n");
      assert.match(history, /Maya/);
      assert.match(history, /appointment availability/i);
      assert.match(history, /Could I come before lunch\?/);
    }
  });

  assert.equal(result.cases.find((item) => item.name === "follow_up_context")?.ok, true);
});

test("testKnowledgeAnswerUsesOnlyFixtureFacts", async () => {
  const good = await runProbe(GOOD_SYNTHETIC_REPLIES);
  assert.equal(good.result.cases.find((item) => item.name === "knowledge_grounding")?.ok, true);
  const replies = [...GOOD_SYNTHETIC_REPLIES];
  replies[0] = { text: BAD_UNSUPPORTED_FACT_REPLY, providerCostMicros: 1 };
  const bad = await runProbe(replies);
  assert.equal(bad.result.cases.find((item) => item.name === "knowledge_grounding")?.ok, false);
});

test("testBusinessBoundaryRefusesMedicalAdviceNaturally", async () => {
  const good = await runProbe(GOOD_SYNTHETIC_REPLIES);
  assert.equal(good.result.cases.find((item) => item.name === "medical_boundary")?.ok, true);
  const replies = [...GOOD_SYNTHETIC_REPLIES];
  replies[2] = { text: BAD_MEDICAL_ADVICE_REPLY, providerCostMicros: 1 };
  const bad = await runProbe(replies);
  assert.equal(bad.result.cases.find((item) => item.name === "medical_boundary")?.ok, false);
});

test("testReplyDoesNotEchoPromptOrRepeatOpening", async () => {
  const good = await runProbe(GOOD_SYNTHETIC_REPLIES);
  assert.equal(good.result.cases.find((item) => item.name === "natural_nonrepetitive_reply")?.ok, true);
  const replies = [...GOOD_SYNTHETIC_REPLIES];
  replies[0] = { text: BAD_PROMPT_ECHO_REPLY, providerCostMicros: 1 };
  replies[1] = { text: "Hi Maya, the clinic is open from 9 am to 1 pm on Saturday.", providerCostMicros: 1 };
  const bad = await runProbe(replies);
  assert.equal(bad.result.cases.find((item) => item.name === "natural_nonrepetitive_reply")?.ok, false);
});

test("testProbeUsesAtMostThreeRepliesAndReportsEstimatedCost", async () => {
  const { result, calls } = await runProbe();
  assert.equal(calls, 3);
  assert.equal(result.providerCostMicros, 36);
  assert.equal(result.cases.length, 4);
});

test("testProbeRejectsRepliesOver256Tokens", async () => {
  const replies = [...GOOD_SYNTHETIC_REPLIES];
  replies[2] = { ...replies[2], outputTokens: 257 };
  const { result } = await runProbe(replies);

  assert.equal(result.cases.find((item) => item.name === "natural_nonrepetitive_reply")?.ok, false);
  assert.equal(result.ok, false);
});
