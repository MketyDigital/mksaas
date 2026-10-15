import assert from "node:assert/strict";
import test from "node:test";

test("significant route increases require explicit confirmation", async () => {
  const { hasSignificantRateIncrease } = await import("../src/billing/rate-change-guard.ts");
  assert.equal(hasSignificantRateIncrease(
    [{ enabled: 1, inputCreditsPerMillion: 1_500_000, outputCreditsPerMillion: 5_000_000 }],
    [{ enabled: 1, inputCreditsPerMillion: 50_000_000, outputCreditsPerMillion: 300_000_000 }],
  ), true);
});

test("rate decreases and changes at or below the 10x boundary do not trigger", async () => {
  const { hasSignificantRateIncrease } = await import("../src/billing/rate-change-guard.ts");
  const previous = [{ enabled: 1, inputCreditsPerMillion: 1_000_000, outputCreditsPerMillion: 2_000_000 }];
  assert.equal(hasSignificantRateIncrease(previous, [{ enabled: 1, inputCreditsPerMillion: 10_000_000, outputCreditsPerMillion: 20_000_000 }]), false);
  assert.equal(hasSignificantRateIncrease(previous, [{ enabled: 1, inputCreditsPerMillion: 500_000, outputCreditsPerMillion: 1_000_000 }]), false);
});
