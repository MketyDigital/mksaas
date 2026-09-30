export const DEFAULT_ENTERPRISE_AI_OPERATIONS_RESERVE_BPS = 1000;
export const DEFAULT_ENTERPRISE_AI_RATE_MULTIPLIER_BPS = 20000;
export const DEFAULT_ENTERPRISE_AI_CREDIT_USD_MICROS = 1000n;

export function calculateEnterpriseAiIncludedCredits(input: {
  monthlyAmountMinor: bigint;
  managedCostShareBps: number;
  operationsReserveBps?: number;
  rateMultiplierBps?: number;
  creditUsdMicros?: bigint;
}) {
  const operationsReserveBps = input.operationsReserveBps ?? DEFAULT_ENTERPRISE_AI_OPERATIONS_RESERVE_BPS;
  const rateMultiplierBps = input.rateMultiplierBps ?? DEFAULT_ENTERPRISE_AI_RATE_MULTIPLIER_BPS;
  const creditUsdMicros = input.creditUsdMicros ?? DEFAULT_ENTERPRISE_AI_CREDIT_USD_MICROS;
  if (input.monthlyAmountMinor <= 0n) throw new Error('Monthly amount must be positive.');
  if (input.managedCostShareBps < 1 || input.managedCostShareBps > 10000) throw new Error('Managed cost share is invalid.');
  if (operationsReserveBps < 0 || operationsReserveBps >= 10000) throw new Error('Operations reserve is invalid.');
  if (rateMultiplierBps < 10000 || rateMultiplierBps > 100000) throw new Error('Rate multiplier is invalid.');
  if (creditUsdMicros <= 0n) throw new Error('Credit unit is invalid.');

  const monthlyUsdMicros = input.monthlyAmountMinor * 10_000n;
  const providerEnvelopeUsdMicros = monthlyUsdMicros * BigInt(input.managedCostShareBps) / 10_000n;
  const usableProviderUsdMicros = providerEnvelopeUsdMicros * BigInt(10_000 - operationsReserveBps) / 10_000n;
  const customerUsageValueUsdMicros = usableProviderUsdMicros * BigInt(rateMultiplierBps) / 10_000n;
  const includedCredits = customerUsageValueUsdMicros / creditUsdMicros;
  return { providerEnvelopeUsdMicros, usableProviderUsdMicros, customerUsageValueUsdMicros, includedCredits };
}

export function providerCostToCreditsPerMillion(input: {
  providerUsdMicrosPerMillion: bigint;
  rateMultiplierBps?: number;
  creditUsdMicros?: bigint;
}) {
  const rateMultiplierBps = input.rateMultiplierBps ?? DEFAULT_ENTERPRISE_AI_RATE_MULTIPLIER_BPS;
  const creditUsdMicros = input.creditUsdMicros ?? DEFAULT_ENTERPRISE_AI_CREDIT_USD_MICROS;
  if (input.providerUsdMicrosPerMillion <= 0n) throw new Error('Provider cost must be positive.');
  return (input.providerUsdMicrosPerMillion * BigInt(rateMultiplierBps) + (creditUsdMicros * 10_000n - 1n))
    / (creditUsdMicros * 10_000n);
}
