/**
 * Assist stores credit values in internal atoms. One USD is 10,000,000 atoms,
 * so one USD micro-dollar maps to exactly 10 atoms. Provider cost fields are
 * micro-USD in the matching unit; the customer multiplier is applied later by
 * the existing settlement path.
 */
const CREDIT_ATOMS_PER_MICRO_USD = 10;

const RATE_FIELDS = [
  ["provider_input_cost_micros_per_million", "input_credits_per_million"],
  ["provider_output_cost_micros_per_million", "output_credits_per_million"],
  ["provider_reasoning_cost_micros_per_million", "reasoning_credits_per_million"],
  ["provider_image_cost_micros", "image_credits"],
  ["provider_audio_cost_micros_per_minute", "audio_credits_per_minute"],
] as const;

export function deriveCustomerBaseRates<T extends Record<string, unknown>>(target: T): T {
  const derived = { ...target };
  for (const [providerField, customerField] of RATE_FIELDS) {
    const providerCostMicros = Number(target[providerField] ?? 0);
    if (Number.isFinite(providerCostMicros) && providerCostMicros > 0) {
      derived[customerField] = Math.ceil(providerCostMicros * CREDIT_ATOMS_PER_MICRO_USD) as T[typeof customerField];
    }
  }
  return derived;
}
