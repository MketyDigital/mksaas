import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const deployWorkflow = await readFile(new URL("../../../.github/workflows/mkety-assist-deploy.yml", import.meta.url), "utf8");

function renderedTargetRow() {
  const start = ui.indexOf("const targetRow=");
  const end = ui.indexOf(";\n  openModal(", start);
  assert.notEqual(start, -1, "route target renderer exists");
  assert.notEqual(end, -1, "route target renderer ends before the editor modal");
  const expression = ui.slice(start + "const targetRow=".length, end);
  const target = {
    provider: "workers-ai", provider_model: "@cf/openai/whisper", enabled: 1,
    input_credits_per_million: 0, output_credits_per_million: 0,
    audio_credits_per_minute: 125, provider_audio_cost_micros_per_minute: 0,
  };
  const context = {
    providers: ["workers-ai"], targets: [target], m: target,
    providerOptions: () => "<option value=''>Built-in</option>",
    esc: (value) => String(value ?? ""),
  };
  const render = vm.runInNewContext(expression, context);
  return render(target, 0);
}

function fieldsInsideRouteRow(html) {
  const stack = [];
  const fields = new Set();
  for (const match of html.matchAll(/<\/?div\b[^>]*>|<(?:input|select)\b[^>]*data-target-(?:provider|connection|model|enabled|input|output|image|audio|cost-input|cost-output|cost-image|cost-audio|reasoning-high|reasoning-maximum|reasoning-credits|reasoning-cost)\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</div")) {
      stack.pop();
      continue;
    }
    if (tag.startsWith("<div")) {
      stack.push(tag.includes("data-target-row=") ? "route" : "div");
      continue;
    }
    const name = tag.match(/data-target-([a-z-]+)/)?.[1];
    if (stack.includes("route") && name) fields.add(name);
  }
  return fields;
}

test("route editor keeps editable controls inside the row that handlers query", () => {
  const fields = fieldsInsideRouteRow(renderedTargetRow());
  for (const field of ["provider", "connection", "model", "enabled", "input", "output", "image", "audio", "cost-input", "cost-output", "cost-image", "cost-audio"]) {
    assert.ok(fields.has(field), `data-target-${field} must be inside data-target-row`);
  }
});

test("model rates UI shows provider-derived base rates and separate text/media multipliers", () => {
  assert.ok(ui.includes("Calculated base rates (MKredit)"));
  assert.ok(ui.includes("data-target-audio"));
  assert.ok(ui.includes("data-target-cost-audio"));
  assert.ok(ui.includes("primary.audio_credits_per_minute??m.audio_credits_per_minute??0"));
  assert.ok(ui.includes("<th>Media customer rate</th>"));
  assert.ok(ui.includes("Image input tokens are also billed at the input-token rate."));
  assert.ok(ui.includes("Changes text usage charges only."));
  assert.ok(ui.includes("Automatic included MKredit uses the plan price, cost envelope and reserve."));
  assert.ok(ui.includes("Automatic allocation uses the plan price, cost envelope and reserve. Rate multipliers affect charges only."));
  assert.match(ui, /data-target-input="'\+i\+'" readonly/);
  assert.match(ui, /data-target-output="'\+i\+'" readonly/);
  assert.match(ui, /data-target-image="'\+i\+'" readonly/);
  assert.match(ui, /data-target-audio="'\+i\+'" readonly/);
  assert.ok(ui.includes("Base MKredit rates are calculated from each target’s provider cost."));
  assert.match(ui, /audio_credits_per_minute/);
  assert.match(ui, /!paused&&targets\.find\(t=>Number\(t\.enabled\?\?1\)===1&&t\.validated===true&&t\.priced===true&&t\.supported!==false\)/);
  assert.match(ui, /Effective target/);
});

test("operator text and media multipliers permit reductions down to one percent", () => {
  assert.match(ui, /id="pMultiplier" type="number" min="1" max="1000"/);
  assert.match(ui, /id="pMediaMultiplier" type="number" min="1" max="1000"/);
  assert.match(api, /customerRateMultiplierPercent,\s*100,\s*1,\s*1000/);
  assert.match(api, /customerMediaRateMultiplierPercent,\s*[^,]+,\s*1,\s*1000/);
  assert.match(api, /parsed < 100 \|\| parsed > 100000/);
});

test("operator deductions add to the customer's lifetime used total", () => {
  const start = api.indexOf('if (url.pathname === "/api/ops/credits"');
  const end = api.indexOf('if (url.pathname === "/api/ops/ledger"', start);
  const handler = api.slice(start, end);
  assert.match(handler, /lifetime_consumed\s*=\s*lifetime_consumed\s*\+/);
  assert.match(handler, /CASE WHEN \?>0 THEN 0 ELSE -\?/);
  assert.match(handler, /WHERE customer_id=\? AND balance\+\?>=0/);
  assert.match(handler, /SELECT balance,lifetime_consumed FROM credit_accounts/);
  assert.match(handler, /used: mkreditsFromCreditAtoms\(Number\(updated\?\.lifetime_consumed/);
  assert.match(handler, /actor_id/);
  assert.match(handler, /operator\.operatorUserId/);
});

test("deployment reconciliation permits manual markup but rejects rates below known provider cost", () => {
  assert.ok(deployWorkflow.includes("input_credits_per_million<provider_input_cost_micros_per_million*10"));
  assert.ok(deployWorkflow.includes("image_credits<provider_image_cost_micros*10"));
  assert.ok(deployWorkflow.includes("reasoning_credits_per_million IS NULL OR reasoning_credits_per_million<provider_reasoning_cost_micros_per_million*10"));
  assert.doesNotMatch(deployWorkflow, /input_credits_per_million<>provider_input_cost_micros_per_million\*10/);
});
