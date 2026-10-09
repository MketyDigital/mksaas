/**
 * Provider-cost baseline. Credit values are internal atoms (10 atoms per USD micro-dollar).
 */
const CREDIT_ATOMS_PER_MICRO_USD = 10;
const LUNA_PUBLIC_RATE = { input: 200_000, output: 1_200_000 };

export function withKnownProviderCosts<T extends Record<string, unknown>>(target: T): T {
  const provider = String(target.provider ?? "").toLowerCase();
  const model = String(target.providerModel ?? target.provider_model ?? "").toLowerCase();
  if (model !== "gpt-5.6-luna" || !["openai", "azure-foundry", "azure-openai"].includes(provider)) return target;
  const inputKey = "providerInputCostMicrosPerMillion" in target ? "providerInputCostMicrosPerMillion" : "provider_input_cost_micros_per_million";
  const outputKey = "providerOutputCostMicrosPerMillion" in target ? "providerOutputCostMicrosPerMillion" : "provider_output_cost_micros_per_million";
  return {
    ...target,
    [inputKey]: Number(target[inputKey] || LUNA_PUBLIC_RATE.input),
    [outputKey]: Number(target[outputKey] || LUNA_PUBLIC_RATE.output),
  };
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
    if (Number.isFinite(providerCostMicros) && providerCostMicros > 0) {
      const customerField = customerCamel in source ? customerCamel : customerSnake;
      derived[customerField] = Math.ceil(providerCostMicros * CREDIT_ATOMS_PER_MICRO_USD);
    }
  }
  const tokenMeteredImage = Number(source.providerInputCostMicrosPerMillion ?? source.provider_input_cost_micros_per_million ?? 0) > 0
    || Number(source.providerOutputCostMicrosPerMillion ?? source.provider_output_cost_micros_per_million ?? 0) > 0;
  const imageCost = Number(source.providerImageCostMicros ?? source.provider_image_cost_micros ?? 0);
  if (tokenMeteredImage && imageCost <= 0) {
    derived["imageCredits" in source ? "imageCredits" : "image_credits"] = 0;
  }
  return derived as T;
}

/**
 * Media fallback rates protect provider-priced features when a provider publishes
 * no image or voice tariff. 20 MKredit = 200,000 internal credit atoms.
 */
export const UNKNOWN_IMAGE_CREDITS = 200_000;
export const UNKNOWN_VOICE_CREDITS_PER_MINUTE = 200_000;

export function deriveCustomerMediaBaseRates<T extends Record<string, unknown>>(
  target: T,
  kind: "vision" | "speech",
): T {
  const derived = deriveCustomerBaseRates(target) as Record<string, unknown>;
  if (kind === "vision") {
    const providerImageCost = Number(derived.providerImageCostMicros ?? derived.provider_image_cost_micros ?? 0);
    const customerKey = "imageCredits" in derived ? "imageCredits" : "image_credits";
    derived[customerKey] = providerImageCost > 0
      ? Math.ceil(providerImageCost * CREDIT_ATOMS_PER_MICRO_USD)
      : UNKNOWN_IMAGE_CREDITS;
  } else {
    const providerAudioCost = Number(derived.providerAudioCostMicrosPerMinute ?? derived.provider_audio_cost_micros_per_minute ?? 0);
    const customerKey = "audioCreditsPerMinute" in derived ? "audioCreditsPerMinute" : "audio_credits_per_minute";
    derived[customerKey] = providerAudioCost > 0
      ? Math.ceil(providerAudioCost * CREDIT_ATOMS_PER_MICRO_USD)
      : UNKNOWN_VOICE_CREDITS_PER_MINUTE;
  }
  return derived as T;
}
