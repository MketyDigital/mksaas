import { bedrockHeadersFromCredentialJson, vertexAccessTokenFromServiceAccount } from "./structured-credentials";
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

export function normalizeFoundryResponsesEndpoint(endpoint: string) {
  const base = endpoint.replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("azure_https_required");
  if (/\/openai\/v1\/responses$/i.test(base)) return base;
  return `${base}/openai/v1/responses`;
}

function billingBlocked(status: number, payload: any) {
  if (status !== 402 && status !== 429) return false;
  const raw = JSON.stringify(payload ?? {}).toLowerCase();
  return /quota|billing|credit|balance|insufficient|payment|fund/i.test(raw);
}

function textFromResponses(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const output = Array.isArray(payload?.output) ? payload.output : [];
  return output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

export async function validateProviderConnection(input: {
  provider: string;
  endpointUrl?: string | null;
  apiKey: string;
  model?: string | null;
  extra?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const extra = input.extra ?? {};
  const model = String(input.model || extra.model || extra.deployment || "").trim();
  const headers: Record<string,string> = { accept: "application/json" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    let payload: any = null;

    if (input.provider === "openai") {
      if (!model) return { ok: false, status: 0, error: "model_required", credentialAccepted: false, billingBlocked: false };
      const base=(input.endpointUrl || "https://api.openai.com/v1").replace(/\/$/,"");
      response=await fetchImpl(base+"/responses",{
        method:"POST",
        headers:{authorization:`Bearer ${input.apiKey}`,"content-type":"application/json"},
        body:JSON.stringify({model,input:"Reply with OK",max_output_tokens:8}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "openai-compatible") {
      if (!input.endpointUrl) return { ok:false,status:0,error:"endpoint_required",credentialAccepted:false,billingBlocked:false };
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      response=await fetchImpl(input.endpointUrl.replace(/\/$/,"")+"/chat/completions",{
        method:"POST",
        headers:{authorization:`Bearer ${input.apiKey}`,"content-type":"application/json"},
        body:JSON.stringify({model,messages:[{role:"user",content:"Reply with OK"}],max_tokens:8,temperature:0}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "azure-foundry") {
      if (!input.endpointUrl) return { ok:false,status:0,error:"endpoint_required",credentialAccepted:false,billingBlocked:false };
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      response=await fetchImpl(normalizeFoundryResponsesEndpoint(input.endpointUrl),{
        method:"POST",
        headers:{"api-key":input.apiKey,"content-type":"application/json"},
        body:JSON.stringify({model,input:"Reply with OK",max_output_tokens:8}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "azure-openai") {
      if (!input.endpointUrl) return { ok:false,status:0,error:"endpoint_required",credentialAccepted:false,billingBlocked:false };
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const apiVersion=String(extra.apiVersion || "2024-10-21");
      response=await fetchImpl(normalizeAzureEndpoint(input.endpointUrl,model,apiVersion),{
        method:"POST",
        headers:{"api-key":input.apiKey,"content-type":"application/json"},
        body:JSON.stringify({messages:[{role:"user",content:"Reply with OK"}],max_tokens:8,temperature:0}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "anthropic") {
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const base=(input.endpointUrl || "https://api.anthropic.com").replace(/\/$/,"");
      response=await fetchImpl(base+"/v1/messages",{
        method:"POST",
        headers:{"x-api-key":input.apiKey,"anthropic-version":String(extra.anthropicVersion || "2023-06-01"),"content-type":"application/json"},
        body:JSON.stringify({model,max_tokens:8,messages:[{role:"user",content:"Reply with OK"}]}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "gemini") {
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const base=(input.endpointUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"");
      response=await fetchImpl(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:"Reply with OK"}]}],generationConfig:{maxOutputTokens:8,temperature:0}}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "vertex") {
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const service=await vertexAccessTokenFromServiceAccount(input.apiKey);
      const projectId=String(extra.projectId || service.projectId || "").trim();
      const location=String(extra.location || "global").trim();
      const host=location==="global"?"aiplatform.googleapis.com":`${location}-aiplatform.googleapis.com`;
      const url=`https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
      response=await fetchImpl(url,{
        method:"POST",
        headers:{authorization:`Bearer ${service.accessToken}`,"content-type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:"Reply with OK"}]}],generationConfig:{maxOutputTokens:8,temperature:0}}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "cloudflare-ai") {
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const accountId=String(extra.accountId || "").trim();
      if (!accountId) return { ok:false,status:0,error:"account_id_required",credentialAccepted:false,billingBlocked:false };
      response=await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,{
        method:"POST",
        headers:{authorization:`Bearer ${input.apiKey}`,"content-type":"application/json"},
        body:JSON.stringify({messages:[{role:"user",content:"Reply with OK"}],max_tokens:8}),
        signal:controller.signal,
        redirect:"error",
      });
    } else if (input.provider === "bedrock") {
      if (!model) return { ok:false,status:0,error:"model_required",credentialAccepted:false,billingBlocked:false };
      const region=String(extra.region || "us-east-1").trim();
      const host=`bedrock-runtime.${region}.amazonaws.com`;
      const path=`/model/${encodeURIComponent(model)}/converse`;
      const body=JSON.stringify({messages:[{role:"user",content:[{text:"Reply with OK"}]}],inferenceConfig:{maxTokens:8,temperature:0}});
      const signed=await bedrockHeadersFromCredentialJson({secret:input.apiKey,region,host,path,body});
      response=await fetchImpl(`https://${host}${path}`,{method:"POST",headers:signed.headers,body,signal:controller.signal,redirect:"error"});
    } else {
      clearTimeout(timer);
      return { ok:false,status:0,error:"unsupported_provider",credentialAccepted:false,billingBlocked:false };
    }

    clearTimeout(timer);
    try { payload=await response.clone().json(); } catch { payload=null; }
    const blocked=billingBlocked(response.status,payload);
    const ok=response.ok;
    const returnedText=input.provider==="azure-foundry" && ok ? textFromResponses(payload) : "";
    return {
      ok,
      status:response.status,
      error:ok?null:(blocked?"provider_billing_blocked":`provider_validation_http_${response.status}`),
      credentialAccepted:ok || blocked,
      billingBlocked:blocked,
      returnedText,
    };
  } catch (error) {
    return { ok:false,status:0,error:error instanceof Error?error.message.slice(0,200):"provider_validation_failed",credentialAccepted:false,billingBlocked:false };
  }
}
