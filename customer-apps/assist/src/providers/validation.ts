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

export async function validateProviderConnection(input: {
  provider: string;
  endpointUrl?: string | null;
  apiKey: string;
  extra?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const extra = input.extra ?? {};
  let url = "";
  const headers: Record<string,string> = { accept: "application/json" };
  if (input.provider === "openai") {
    url = (input.endpointUrl || "https://api.openai.com/v1").replace(/\/$/,"") + "/models";
    headers.authorization = `Bearer ${input.apiKey}`;
  } else if (input.provider === "openai-compatible") {
    if (!input.endpointUrl) return { ok: false, status: 0, error: "endpoint_required" };
    url = input.endpointUrl.replace(/\/$/,"") + "/models";
    headers.authorization = `Bearer ${input.apiKey}`;
  } else if (input.provider === "anthropic") {
    url = (input.endpointUrl || "https://api.anthropic.com").replace(/\/$/,"") + "/v1/models";
    headers["x-api-key"] = input.apiKey;
    headers["anthropic-version"] = String(extra.anthropicVersion || "2023-06-01");
  } else if (input.provider === "gemini") {
    url = (input.endpointUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"") + "/models?key=" + encodeURIComponent(input.apiKey);
  } else if (input.provider === "azure-openai") {
    if (!input.endpointUrl) return { ok: false, status: 0, error: "endpoint_required" };
    url = input.endpointUrl.replace(/\/$/,"") + "/openai/models?api-version=" + encodeURIComponent(String(extra.apiVersion || "2024-10-21"));
    headers["api-key"] = input.apiKey;
  } else if (input.provider === "azure-foundry") {
    if (!input.endpointUrl) return { ok: false, status: 0, error: "endpoint_required" };
    url = input.endpointUrl.replace(/\/$/,"") + "/models?api-version=" + encodeURIComponent(String(extra.apiVersion || "2024-05-01-preview"));
    headers["api-key"] = input.apiKey;
  } else if (input.provider === "vertex" || input.provider === "cloudflare-ai") {
    if (!input.endpointUrl) return { ok: false, status: 0, error: "endpoint_required" };
    url = input.endpointUrl;
    headers.authorization = `Bearer ${input.apiKey}`;
  } else if (input.provider === "bedrock") {
    const region = String(extra.region || "");
    const accessKeyId = String(extra.accessKeyId || "");
    const secretAccessKey = String(extra.secretAccessKey || "");
    return { ok: Boolean(region && accessKeyId && secretAccessKey), status: 0, error: region && accessKeyId && secretAccessKey ? null : "bedrock_credentials_incomplete" };
  } else {
    return { ok: false, status: 0, error: "unsupported_provider" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetchImpl(url, { method: "GET", headers, signal: controller.signal, redirect: "error" });
    clearTimeout(timer);
    const ok = response.ok;
    return { ok, status: response.status, error: ok ? null : `provider_validation_http_${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message.slice(0,200) : "provider_validation_failed" };
  }
}
