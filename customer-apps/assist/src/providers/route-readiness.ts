export type RouteTargetReadiness = {
  enabled?: number | boolean;
  validated?: boolean;
  priced?: boolean;
  supported?: boolean;
};

export function evaluateMediaReadiness(input: {
  featureEnabled: boolean;
  aliasStatus: string;
  targets: RouteTargetReadiness[];
}) {
  const eligibleTargetCount = input.targets.filter((target) =>
    target.enabled !== false && Number(target.enabled ?? 1) !== 0 && target.validated === true && target.priced === true && target.supported !== false,
  ).length;
  const state = !input.featureEnabled
    ? "feature_disabled"
    : input.aliasStatus === "paused"
      ? "alias_paused"
      : input.aliasStatus !== "active"
        ? "alias_disabled"
        : eligibleTargetCount > 0 ? "ready" : "route_unavailable";
  return { state, eligibleTargetCount, targetCount: input.targets.length };
}

export function routeTargetPricingConfigured(target: Record<string, unknown>, alias: string) {
  const input = Number(target.input_credits_per_million || 0);
  const output = Number(target.output_credits_per_million || 0);
  if (alias === "mkety-media-vision") {
    return input > 0 || output > 0 || Number(target.image_credits || 0) > 0;
  }
  if (alias === "mkety-media-speech") {
    return input > 0 || output > 0 || Number(target.audio_credits_per_minute || 0) > 0;
  }
  return input > 0 && output > 0;
}

export function routeTargetValidated(target: Record<string, unknown>) {
  const provider = String(target.provider || "");
  if (provider === "workers-ai" || provider === "mkety-managed") return true;
  return target.provider_connection_status === "active" && Boolean(target.provider_connection_validated_at);
}

export function routeTargetMediaSupported(target: Record<string, unknown>, alias: string) {
  const provider = String(target.provider || "");
  const vision = ["workers-ai", "mkety-managed", "vertex", "gemini", "azure-foundry", "openai", "azure-openai"];
  const speech = ["workers-ai", "mkety-managed", "vertex", "gemini", "azure-foundry", "openai"];
  if (alias === "mkety-media-vision") return vision.includes(provider);
  if (alias === "mkety-media-speech") return speech.includes(provider);
  return true;
}

export function evaluateRouteReadiness(aliasStatus: string, targets: Array<RouteTargetReadiness & { reasoningCapabilities?: string[] }>) {
  const eligible = targets.filter((target) =>
    target.enabled !== false && Number(target.enabled ?? 1) !== 0 && target.validated === true && target.priced === true && target.supported !== false,
  );
  return {
    state: aliasStatus !== "active" ? "paused" : eligible.length ? "ready" : "unavailable",
    aliasStatus,
    eligibleTargetCount: eligible.length,
    targetCount: targets.length,
    reasoningCapabilities: [...new Set(eligible.flatMap((target) => target.reasoningCapabilities || ["standard"]))],
  };
}
