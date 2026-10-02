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

const validationEncoder = new TextEncoder();

function base64UrlBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlText(value: string) {
  return base64UrlBytes(validationEncoder.encode(value));
}

function pemPkcs8Bytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  if (!body) throw new Error("vertex_private_key_invalid");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function getVertexAccessToken(credentialsJson: string, fetchImpl: typeof fetch = fetch) {
  let credentials: any;
  try { credentials = JSON.parse(credentialsJson); } catch { throw new Error("vertex_credentials_must_be_json"); }
  const email = String(credentials.client_email || "").trim();
  const privateKey = String(credentials.private_key || "");
  if (!email || !privateKey) throw new Error("vertex_service_account_json_incomplete");
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlText(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const pkcs8 = pemPkcs8Bytes(privateKey);
  const pkcs8Buffer = pkcs8.buffer.slice(pkcs8.byteOffset, pkcs8.byteOffset + pkcs8.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, validationEncoder.encode(signingInput)));
  const assertion = `${signingInput}.${base64UrlBytes(signature)}`;
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`vertex_oauth_http_${response.status}`);
  return String(payload.access_token);
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", validationEncoder.encode(value)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: string | Uint8Array, value: string) {
  const bytes = typeof key === "string" ? validationEncoder.encode(key) : key;
  const keyData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const imported = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, validationEncoder.encode(value)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function bedrockHeaders(input: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  host: string;
  path: string;
  body: string;
}) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(input.body);
  const pairs: Array<[string,string]> = [
    ["content-type","application/json"],
    ["host",input.host],
    ["x-amz-content-sha256",payloadHash],
    ["x-amz-date",amzDate],
  ];
  if (input.sessionToken) pairs.push(["x-amz-security-token", input.sessionToken]);
  pairs.sort(([a],[b]) => a.localeCompare(b));
  const canonicalHeaders = pairs.map(([k,v]) => `${k}:${v.trim()}\n`).join("");
  const signedHeaders = pairs.map(([k]) => k).join(";");
  const canonicalRequest = ["POST", input.path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/bedrock/aws4_request`;
  const canonicalHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${canonicalHash}`;
  const dateKey = await hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, input.region);
  const serviceKey = await hmac(regionKey, "bedrock");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "content-type": "application/json",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(input.sessionToken ? { "x-amz-security-token": input.sessionToken } : {}),
  };
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
    if (input.provider === "openai") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      const base = endpoint || "https://api.openai.com/v1";
      const response = await fetchImpl(base + "/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          input: "Reply exactly: OK",
          max_output_tokens: 8,
        }),
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "openai-compatible") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialsAccepted: false, billingBlocked: false };
      if (!endpoint) return { ok: false, status: 0, error: "endpoint_required", credentialsAccepted: false, billingBlocked: false };
      const response = await fetchImpl(endpoint + "/chat/completions", {
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
      const sessionToken = String(extra.sessionToken || "");
      if (!region || !accessKeyId || !secretAccessKey || !model) {
        return { ok: false, status: 0, error: "bedrock_credentials_incomplete", credentialsAccepted: false, billingBlocked: false, model };
      }
      const host = `bedrock-runtime.${region}.amazonaws.com`;
      const path = `/model/${encodeURIComponent(model)}/converse`;
      const body = JSON.stringify({
        messages: [{ role: "user", content: [{ text: "Reply exactly: OK" }] }],
        inferenceConfig: { maxTokens: 8, temperature: 0 },
      });
      const headers = await bedrockHeaders({ accessKeyId, secretAccessKey, sessionToken: sessionToken || undefined, region, host, path, body });
      const response = await fetchImpl(`https://${host}${path}`, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
        redirect: "error",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return providerError(response.status, payload);
      return { ok: true, status: response.status, error: null, credentialsAccepted: true, billingBlocked: false, model };
    }

    if (input.provider === "vertex") {
      let credential: Record<string, unknown> = {};
      try { credential = JSON.parse(input.apiKey); } catch {
        return { ok: false, status: 0, error: "vertex_credentials_must_be_json", credentialsAccepted: false, billingBlocked: false, model };
      }
      const projectId = String(extra.projectId || credential.project_id || "");
      const location = String(extra.location || "global");
      if (!projectId || !credential.client_email || !credential.private_key || !model) {
        return { ok: false, status: 0, error: "vertex_service_account_json_incomplete", credentialsAccepted: false, billingBlocked: false, model };
      }
      const token = await getVertexAccessToken(input.apiKey, fetchImpl);
      const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
      const response = await fetchImpl(
        `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
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
