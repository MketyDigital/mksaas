import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const api = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const start = api.indexOf("function calculateCommercialPlan(input:");
const end = api.indexOf("\nfunction publicCreditFields", start);
assert.notEqual(start, -1, "commercial plan calculation exists");
assert.notEqual(end, -1, "commercial plan calculation has a stable boundary");
const functionSource = api.slice(start, end).replace(
  /function calculateCommercialPlan\(input: \{[\s\S]*?\}\) \{/,
  "function calculateCommercialPlan(input) {",
);

const calculateCommercialPlan = vm.runInNewContext(`
  const MKREDITS_PER_USD = 1_000;
  const CREDIT_ATOMS_PER_USD = 10_000_000;
  const CREDIT_ATOMS_PER_MKREDIT = CREDIT_ATOMS_PER_USD / MKREDITS_PER_USD;
  class HttpError extends Error { constructor(status, code) { super(code); this.status = status; } }
  function creditAtomsFromUsdMicros(usdMicros) {
    return usdMicros <= 0 ? 0 : Math.ceil((usdMicros * CREDIT_ATOMS_PER_USD) / 1_000_000);
  }
  function mkreditsFromCreditAtoms(atoms) {
    return Math.round((atoms / CREDIT_ATOMS_PER_MKREDIT) * 10_000) / 10_000;
  }
  ${functionSource}
  calculateCommercialPlan;
`);

test("automatic included MKredit is independent of text and media rate multipliers", () => {
  const plan = { monthlyAmountMinor: 10_000, providerEnvelopeBps: 1_500, operationsReserveBps: 1_000 };
  const atBaseRates = calculateCommercialPlan({ ...plan, rateMultiplierBps: 10_000, mediaRateMultiplierBps: 10_000 });
  const atDoubledRates = calculateCommercialPlan({ ...plan, rateMultiplierBps: 20_000, mediaRateMultiplierBps: 20_000 });

  assert.equal(atBaseRates.providerEnvelopeUsdMicros, 15_000_000);
  assert.equal(atBaseRates.usableProviderUsdMicros, 13_500_000);
  assert.equal(atBaseRates.includedMkredits, 13_500);
  assert.equal(atDoubledRates.includedMkredits, atBaseRates.includedMkredits);
});
