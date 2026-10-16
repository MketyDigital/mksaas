import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeMonthlyCreditCap, normalizeMonthlyCreditCapMode } from "../src/assistants/service.ts";

const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/ui.ts", import.meta.url), "utf8");

test("blank cap clears to null and positive MKredits convert to atoms", () => {
  assert.equal(normalizeMonthlyCreditCap(null), null);
  assert.equal(normalizeMonthlyCreditCap(""), null);
  assert.equal(normalizeMonthlyCreditCap("2.5"), 25000);
});

test("cap inputs reject zero, negative, non-finite and unsafe amounts", () => {
  for (const value of [0, "0", -1, "NaN", Infinity, 1e20]) {
    assert.throws(() => normalizeMonthlyCreditCap(value), /invalid_monthly_credit_cap/);
  }
});

test("cap mode accepts only soft or hard", () => {
  assert.equal(normalizeMonthlyCreditCapMode("soft"), "soft");
  assert.equal(normalizeMonthlyCreditCapMode("hard"), "hard");
  assert.throws(() => normalizeMonthlyCreditCapMode("disabled"), /invalid_monthly_credit_cap_mode/);
});

test("owner cap UI explains mode and shows settled aggregate only", () => {
  assert.match(ui, /Monthly cap behavior/);
  assert.match(ui, /Soft cap/);
  assert.match(ui, /Hard cap/);
  assert.match(runtime, /monthly_cap_used_atoms/);
  assert.doesNotMatch(runtime, /monthly_cap_open_reservations/);
});
