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

function providerError(status: number, payload: unknown) {
  const text = JSON.stringify(payload ?? {}).slice(0, 1200);
  const billingBlocked =
    status === 402 ||
    status === 429 && /quota|billing|insufficient|credit|balance|payment/i.test(text);
  const credentialsAccepted =
    billingBlocked ||
    ![401, 403].includes(status);
  return {
    ok: false,
    status,
    error: billingBlocked ? "provider_billing_or_quota_blocked" : `provider_validation_http_${status}`,
    billingBlocked,
    credentialsAccepted,
    details: text,
  };
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
  const model = String(extra.defaultModel || extra.model || extra.deployment || "").trim();
  const endpoint = String(input.endpointUrl || "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    if (input.provider === "openai" || input.provider === "openai-compatible") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const base = endpoint || (input.provider === "openai" ? "https://api.openai.com/v1" : "");
      if (!base) return { ok: false, status: 0, error: "endpoint_required", credentialsAccepted: false, billingBlocked: false };
      const response = await fetchImpl(base + "/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply exactly: OK" }],
          max_tokens: 8,
          temperature: 0,
        }),
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "azure-foundry") {
      if (!endpoint) return { ok: false, status: 0, error: "endpoint_required", credentialsAccepted: false, billingBlocked: false };
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const url = endpoint.includes("/openai/v1/responses") ? endpoint : endpoint + "/openai/v1/responses";
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "api-key": input.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ model, input: "Reply exactly: OK", max_output_tokens: 8 }),
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "azure-openai") {
      if (!endpoint) return { ok: false, status: 0, error: "endpoint_required", credentialsAccepted: false, billingBlocked: false };
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const apiVersion = String(extra.apiVersion || "2024-10-21");
      const url = normalizeAzureEndpoint(endpoint, model, apiVersion);
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "api-key": input.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Reply exactly: OK" }],
          max_tokens: 8,
          temperature: 0,
        }),
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "anthropic") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const base = endpoint || "https://api.anthropic.com";
      const response = await fetchImpl(base + "/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": input.apiKey,
          "anthropic-version": String(extra.anthropicVersion || "2023-06-01"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          temperature: 0,
          messages: [{ role: "user", content: "Reply exactly: OK" }],
        }),
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "gemini") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const base = endpoint || "https://generativelanguage.googleapis.com/v1beta";
      const response = await fetchImpl(
        `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply exactly: OK" }] }],
            generationConfig: { maxOutputTokens: 8, temperature: 0 },
          }),
          signal: controller.signal,
          redirect: "error",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "bedrock") {
      const region = String(extra.region || "");
      const accessKeyId = String(extra.accessKeyId || "");
      const secretAccessKey = String(extra.secretAccessKey || input.apiKey || "");
      const ready = Boolean(region && accessKeyId && secretAccessKey && model);
      return {
        ok: ready,
        status: 0,
        error: ready ? null : "bedrock_credentials_incomplete",
        credentialsAccepted: ready,
        billingBlocked: false,
        model,
      };
    }

    if (input.provider === "vertex") {
      let credential: Record<string, unknown> = {};
      try { credential = JSON.parse(input.apiKey); } catch {}
      const projectId = String(extra.projectId || credential.project_id || "");
      const location = String(extra.location || "global");
      const ready = Boolean(projectId && location && credential.client_email && credential.private_key && model);
      return {
        ok: ready,
        status: 0,
        error: ready ? null : "vertex_service_account_json_incomplete",
        credentialsAccepted: ready,
        billingBlocked: false,
        model,
      };
    }

    if (input.provider === "cloudflare-ai") {
      if (!endpoint) return { ok: false, status: 0, error: "endpoint_required", credentialsAccepted: false, billingBlocked: false };
      const response = await fetchImpl(endpoint, {
        method: "GET",
        headers: { authorization: `Bearer ${input.apiKey}` },
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    return { ok: false, status: 0, error: "unsupported_provider", credentialsAccepted: false, billingBlocked: false };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message.slice(0, 300) : "provider_validation_failed",
      credentialsAccepted: false,
      billingBlocked: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
