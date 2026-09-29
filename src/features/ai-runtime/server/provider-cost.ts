export type ManagedAiCostRate = {
  model: string;
  verifiedAt: string;
  inputUsdMicrosPerMillion: bigint;
  cachedInputUsdMicrosPerMillion?: bigint;
  outputUsdMicrosPerMillion: bigint;
};

export const MANAGED_AI_COST_RATES: readonly ManagedAiCostRate[] = [
  {
    model: '@cf/google/gemma-4-26b-a4b-it',
    verifiedAt: '2026-09-28',
    inputUsdMicrosPerMillion: 100_000n,
    outputUsdMicrosPerMillion: 300_000n,
  },
  {
    model: '@cf/zai-org/glm-5.3-flash',
    verifiedAt: '2026-09-28',
    inputUsdMicrosPerMillion: 150_000n,
    cachedInputUsdMicrosPerMillion: 30_000n,
    outputUsdMicrosPerMillion: 500_000n,
  },
  {
    model: '@cf/qwen/qwen3.8-27b',
    verifiedAt: '2026-09-28',
    inputUsdMicrosPerMillion: 450_000n,
    cachedInputUsdMicrosPerMillion: 50_000n,
    outputUsdMicrosPerMillion: 3_200_000n,
  },
] as const;

const ONE_MILLION = 1_000_000n;
const BPS = 10_000n;

function ceilDiv(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - 1n) / denominator;
}

export function calculateProviderCostUsdMicros(input: {
  rate: ManagedAiCostRate;
  inputTokens: bigint;
  cachedInputTokens?: bigint;
  outputTokens: bigint;
}) {
  const cached = input.cachedInputTokens ?? 0n;
  const uncached = input.inputTokens > cached ? input.inputTokens - cached : 0n;
  const cachedRate = input.rate.cachedInputUsdMicrosPerMillion ?? input.rate.inputUsdMicrosPerMillion;

  return (
    ceilDiv(uncached * input.rate.inputUsdMicrosPerMillion, ONE_MILLION) +
    ceilDiv(cached * cachedRate, ONE_MILLION) +
    ceilDiv(input.outputTokens * input.rate.outputUsdMicrosPerMillion, ONE_MILLION)
  );
}

export function minimumCustomerRevenueUsdMicros(
  providerCostUsdMicros: bigint,
  options: { targetGrossMarginBps?: number; overheadReserveBps?: number } = {},
) {
  const targetGrossMarginBps = BigInt(options.targetGrossMarginBps ?? 6500);
  const overheadReserveBps = BigInt(options.overheadReserveBps ?? 1500);
  if (targetGrossMarginBps < 0n || targetGrossMarginBps >= BPS) throw new Error('Invalid target margin.');
  if (overheadReserveBps < 0n) throw new Error('Invalid overhead reserve.');

  const marginDenominator = BPS - targetGrossMarginBps;
  const revenueBeforeOverhead = ceilDiv(providerCostUsdMicros * BPS, marginDenominator);
  return ceilDiv(revenueBeforeOverhead * (BPS + overheadReserveBps), BPS);
}

export function getManagedAiCostRate(model: string) {
  return MANAGED_AI_COST_RATES.find((rate) => rate.model === model) ?? null;
}
