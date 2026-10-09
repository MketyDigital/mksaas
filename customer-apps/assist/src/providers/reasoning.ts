export type ReasoningMode = "standard" | "high" | "maximum";
export type ReasoningFallbackPolicy = "allow_lower_effort" | "strict";

const ORDER: ReasoningMode[] = ["maximum", "high", "standard"];

function knownCapabilities(provider: string, model: string): ReasoningMode[] {
  const p = provider.toLowerCase();
  const m = model.toLowerCase();
  if ((p === "workers-ai" || p === "mkety-managed") && /(?:^|\/)glm-5(?:\.3)?-flash/.test(m)) {
    return ["standard", "high", "maximum"];
  }
  if (["openai", "azure-foundry"].includes(p) && /(?:^|\/)gpt-[56](?:[.-]|$)/.test(m)) {
    return ["standard", "high", "maximum"];
  }
  if (p === "azure-openai" && /(?:^|\/)gpt-5(?:[.-]|$)/.test(m)) return ["standard", "high"];
  if (p === "anthropic" && /claude-(?:3-7|4|sonnet-4|opus-4)/.test(m)) {
    return ["standard", "high", "maximum"];
  }
  if (["gemini", "vertex"].includes(p) && /gemini-3/.test(m)) return ["standard", "high"];
  return ["standard"];
}

export function reasoningCapabilities(provider: string, model: string, configured: string[] = []): ReasoningMode[] {
  const known = new Set(knownCapabilities(provider, model));
  const configuredModes = new Set((Array.isArray(configured) ? configured : [])
    .filter((value): value is ReasoningMode => value === "standard" || value === "high" || value === "maximum"));
  // An explicit operator declaration may narrow or document a provider's support, but
  // cannot claim a tier the adapter cannot encode safely.
  const adapter = adapterCapabilities(provider, model);
  if (configuredModes.size) {
    return ["standard", ...["high", "maximum"].filter((mode) => configuredModes.has(mode as ReasoningMode) && adapter.has(mode as ReasoningMode)) as ReasoningMode[]];
  }
  return ORDER.slice().reverse().filter((mode) => known.has(mode) && adapter.has(mode));
}

function adapterCapabilities(provider: string, model: string): Set<ReasoningMode> {
  const p = provider.toLowerCase();
  const m = model.toLowerCase();
  if ((p === "workers-ai" || p === "mkety-managed") && /(?:^|\/)glm-5(?:\.3)?-flash/.test(m)) return new Set(["standard", "high", "maximum"]);
  if (["openai", "azure-foundry"].includes(p) && /(?:^|\/)gpt-[56](?:[.-]|$)/.test(m)) return new Set(["standard", "high", "maximum"]);
  if (p === "azure-openai" && /(?:^|\/)gpt-5(?:[.-]|$)/.test(m)) return new Set(["standard", "high"]);
  if (p === "anthropic" && /claude-(?:3-7|4|sonnet-4|opus-4)/.test(m)) return new Set(["standard", "high", "maximum"]);
  if (["gemini", "vertex"].includes(p) && /gemini-3/.test(m)) return new Set(["standard", "high"]);
  if (p === "openai-compatible" && m) return new Set(["standard", "high", "maximum"]);
  return new Set(["standard"]);
}

export function providerReasoningOptions(provider: string, model: string, mode: ReasoningMode, configured: string[] = []): Record<string, unknown> | null {
  if (mode === "standard" || !reasoningCapabilities(provider, model, configured).includes(mode)) return null;
  const p = provider.toLowerCase();
  if (p === "workers-ai" || p === "mkety-managed") return { reasoning_effort: mode === "maximum" ? "max" : "high" };
  if (p === "openai" || p === "azure-foundry") return { reasoning: { effort: mode === "maximum" ? "xhigh" : "high" } };
  if (p === "azure-openai") return mode === "high" ? { reasoning_effort: "high" } : null;
  if (p === "openai-compatible") return { reasoning_effort: mode === "maximum" ? "max" : "high" };
  if (p === "anthropic") return { thinking: { type: "adaptive" }, output_config: { effort: mode === "maximum" ? "max" : "high" } };
  if (p === "gemini" || p === "vertex") return { generationConfig: { thinkingConfig: { thinkingLevel: "HIGH" } } };
  return null;
}

export function planReasoningTargets<T extends { provider: string; provider_model: string; enabled?: number | boolean; reasoning_capabilities_json?: string | null }>(
  targets: T[], requestedMode: ReasoningMode, fallbackPolicy: ReasoningFallbackPolicy,
) {
  const enabled = targets.filter((target) => target.enabled !== false && Number(target.enabled ?? 1) !== 0);
  const candidateModes: ReasoningMode[] = fallbackPolicy === "strict"
    ? [requestedMode]
    : requestedMode === "maximum" ? ["maximum", "high", "standard"] as ReasoningMode[]
      : requestedMode === "high" ? ["high", "standard"] as ReasoningMode[] : ["standard"];
  for (const appliedMode of candidateModes) {
    const eligible = enabled.filter((target) => {
      let configured: string[] = [];
      try { configured = JSON.parse(String(target.reasoning_capabilities_json || "[]")); } catch { configured = []; }
      return reasoningCapabilities(target.provider, target.provider_model, configured).includes(appliedMode);
    });
    if (eligible.length) return { requestedMode, appliedMode, downgraded: requestedMode !== appliedMode, targets: eligible };
  }
  throw new Error(`no_eligible_reasoning_target:${requestedMode}:${fallbackPolicy}`);
}
