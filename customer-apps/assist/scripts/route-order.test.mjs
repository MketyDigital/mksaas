import assert from "node:assert/strict";
import test from "node:test";
import { moveRouteTarget } from "../src/route-order.ts";

test("moving a route target returns a reordered copy with target metadata intact", () => {
  const primary = { provider: "azure-foundry", provider_model: "model-a", pricing: { input: 3 } };
  const fallback = { provider: "workers-ai", provider_model: "model-b", pricing: { input: 7 } };
  const last = { provider: "openai", provider_model: "model-c", reasoning_capabilities: ["high"] };
  const before = [primary, fallback, last];

  const after = moveRouteTarget(before, 1, 0);

  assert.deepEqual(after, [fallback, primary, last]);
  assert.notEqual(after, before);
  assert.deepEqual(before, [primary, fallback, last]);
  assert.equal(after[0], fallback);
  assert.equal(after[0].pricing, fallback.pricing);
  assert.equal(after[1], primary);
  assert.equal(after[1].pricing, primary.pricing);
  assert.equal(after[2], last);
  assert.equal(after[2].reasoning_capabilities, last.reasoning_capabilities);
});

test("invalid route indices leave the order unchanged", () => {
  const targets = [{ provider: "azure-foundry" }, { provider: "workers-ai" }];

  assert.deepEqual(moveRouteTarget(targets, -1, 0), targets);
  assert.deepEqual(moveRouteTarget(targets, 0, 2), targets);
  assert.deepEqual(moveRouteTarget(targets, 1, 1), targets);
  assert.deepEqual(targets, [{ provider: "azure-foundry" }, { provider: "workers-ai" }]);
});
