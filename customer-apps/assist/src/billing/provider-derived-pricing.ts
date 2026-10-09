/**
 * Provider-cost baseline. Credit values are internal atoms (10 atoms per USD micro-dollar).
 */
const CREDIT_ATOMS_PER_MICRO_USD = 10;
const TEXT_INPUT_MINIMUM = 20_000_000;
const TEXT_OUTPUT_MINIMUM = 100_000_000;
const IMAGE_MINIMUM = 200_000;
const VOICE_MINIMUM = 200_000;
const PUBLIC_OPENAI_RATES: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 200_000, output: 1_200_000 },
  "gpt-6-luna": { input: 100_000, output: 500_000 },
};
const AZURE_PUBLIC_RATES: Record<string, { input: number; output: number; source: string; tier: string; verified: string }> = {
  "gpt-6-luna-1": {
    input: 100_000,
    output: 500_000,
    source: "https://azure.microsoft.com/en-us/blog/gpt-6-astra-sol-and-luna-for-production-agents-in-microsoft-foundry/",
    tier: "Microsoft Foundry Global Standard, short context; public offer estimate",
    verified: "2026-10-09",
  },
};

export function withKnownProviderCosts<T extends Record<string, unknown>>(target: T): T {
  const provider = String(target.provider ?? "").toLowerCase();
  const model = String(target.providerModel ?? target.provider_model ?? "").toLowerCase();
  // Azure deployment charges depend on tier/region/context; attach the public
  // offer as an explicitly labeled estimate unless actual provider costs exist.
  const azureRate = provider === "azure-foundry" ? AZURE_PUBLIC_RATES[model] : undefined;
  const publicRate = provider === "openai" ? PUBLIC_OPENAI_RATES[model] : azureRate;
  if (!publicRate) return target;
  const inputKey = "providerInputCostMicrosPerMillion" in target ? "providerInputCostMicrosPerMillion" : "provider_input_cost_micros_per_million";
  const outputKey = "providerOutputCostMicrosPerMillion" in target ? "providerOutputCostMicrosPerMillion" : "provider_output_cost_micros_per_million";
  const usesPublicInput = !(Number(target[inputKey]) > 0);
  const usesPublicOutput = !(Number(target[outputKey]) > 0);
  const result = {
    ...target,
    [inputKey]: Number(target[inputKey] || publicRate.input),
    [outputKey]: Number(target[outputKey] || publicRate.output),
  };
  if (azureRate && (usesPublicInput || usesPublicOutput)) {
    Object.assign(result, {
      provider_pricing_source: usesPublicInput && usesPublicOutput ? "public_offer_estimate" : "reported_plus_public_offer_estimate",
      provider_pricing_tier: azureRate.tier,
      provider_pricing_verified_at: azureRate.verified,
      provider_pricing_source_url: azureRate.source,
    });
  }
  return result;
}

const RATE_FIELDS = [
  ["provider_input_cost_micros_per_million", "providerInputCostMicrosPerMillion", "input_credits_per_million", "inputCreditsPerMillion"],
  ["provider_output_cost_micros_per_million", "providerOutputCostMicrosPerMillion", "output_credits_per_million", "outputCreditsPerMillion"],
  ["provider_reasoning_cost_micros_per_million", "providerReasoningCostMicrosPerMillion", "reasoning_credits_per_million", "reasoningCreditsPerMillion"],
  ["provider_image_cost_micros", "providerImageCostMicros", "image_credits", "imageCredits"],
  ["provider_audio_cost_micros_per_minute", "providerAudioCostMicrosPerMinute", "audio_credits_per_minute", "audioCreditsPerMinute"],
] as const;

export function deriveCustomerBaseRates<T extends Record<string, unknown>>(target: T): T {
  const source = withKnownProviderCosts(target);
  const derived: Record<string, unknown> = { ...source };
  for (const [providerSnake, providerCamel, customerSnake, customerCamel] of RATE_FIELDS) {
    const providerCostMicros = Number(source[providerCamel] ?? source[providerSnake] ?? 0);
    const customerField = customerCamel in source ? customerCamel : customerSnake;
    const minimum = customerSnake.startsWith("input_") ? TEXT_INPUT_MINIMUM
      : customerSnake.startsWith("output_") || customerSnake.startsWith("reasoning_") ? TEXT_OUTPUT_MINIMUM
        : customerSnake === "image_credits" ? IMAGE_MINIMUM
          : customerSnake === "audio_credits_per_minute" ? VOICE_MINIMUM : 0;
    const providerRate = Number.isFinite(providerCostMicros) && providerCostMicros > 0
      ? Math.ceil(providerCostMicros * CREDIT_ATOMS_PER_MICRO_USD)
      : 0;
    derived[customerField] = Math.max(minimum, providerRate);
  }
  return derived as T;
}

/**
 * Media fallback rates protect provider-priced features when a provider publishes
 * no image or voice tariff. 20 MKredit = 200,000 internal credit atoms.
 */
export const UNKNOWN_IMAGE_CREDITS = IMAGE_MINIMUM;
export const UNKNOWN_VOICE_CREDITS_PER_MINUTE = VOICE_MINIMUM;

export function deriveCustomerMediaBaseRates<T extends Record<string, unknown>>(
  target: T,
  kind: "vision" | "speech",
): T {
  const derived = deriveCustomerBaseRates(target) as Record<string, unknown>;
  if (kind === "vision") {
    const providerImageCost = Number(derived.providerImageCostMicros ?? derived.provider_image_cost_micros ?? 0);
    const customerKey = "imageCredits" in derived ? "imageCredits" : "image_credits";
    derived[customerKey] = providerImageCost > 0
      ? Math.max(UNKNOWN_IMAGE_CREDITS, Math.ceil(providerImageCost * CREDIT_ATOMS_PER_MICRO_USD))
      : UNKNOWN_IMAGE_CREDITS;
  } else {
    const providerAudioCost = Number(derived.providerAudioCostMicrosPerMinute ?? derived.provider_audio_cost_micros_per_minute ?? 0);
    const customerKey = "audioCreditsPerMinute" in derived ? "audioCreditsPerMinute" : "audio_credits_per_minute";
    derived[customerKey] = providerAudioCost > 0
      ? Math.max(UNKNOWN_VOICE_CREDITS_PER_MINUTE, Math.ceil(providerAudioCost * CREDIT_ATOMS_PER_MICRO_USD))
      : UNKNOWN_VOICE_CREDITS_PER_MINUTE;
  }
  return derived as T;
}
