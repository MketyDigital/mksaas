import type { ByokPolicy, ProviderCapability } from "./types";

const CAPABILITIES: Record<string, ProviderCapability[]> = {
  "workers-ai": ["text", "vision"],
  "mkety-managed": ["text", "vision"],
  openai: ["text", "vision", "audio", "tools"],
  anthropic: ["text", "vision", "tools"],
  gemini: ["text", "vision", "audio", "tools"],
  vertex: ["text", "vision", "audio", "tools"],
  bedrock: ["text", "vision", "tools"],
  "azure-openai": ["text", "vision", "audio", "tools"],
  "azure-foundry": ["text", "vision", "audio", "tools"],
  "openai-compatible": ["text"],
};

export function providerSupports(provider: string, required: ProviderCapability[]) {
  const have = new Set(CAPABILITIES[provider] ?? []);
  return required.every((cap) => have.has(cap));
}

export function mayUseFallback(policy: ByokPolicy, primaryIsByok: boolean, fallbackIsManaged: boolean) {
  if (!primaryIsByok) return true;
  if (!fallbackIsManaged) return true;
  return policy === "explicit_paid_fallback";
}

export function normalizeAzureEndpoint(endpoint: string, deployment: string, apiVersion: string) {
  const base = endpoint.replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("azure_https_required");
  if (!deployment || !apiVersion) throw new Error("azure_deployment_and_version_required");
  return `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
}
