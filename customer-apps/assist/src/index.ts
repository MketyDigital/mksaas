/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleApiKeyInference, handleAssistantTelegramWebhook, handleRuntimeApi, inspectStaleAttemptProjections, invokeProviderModel, processDueReminders, processInboundQueue, processReplyQueue, recoverReplyJobs, runtimeErrorResponse, syncTelegramBusinessWebhookCapabilities } from "./runtime";
import { finishOperatorOidc, startOperatorOidc } from "./operator-oidc";
import { renderCustomerPortal, renderOperatorPortal } from "./ui";
import { customerUsageProjection } from "./billing/metering";
import { deriveCustomerBaseRates, deriveCustomerMediaBaseRates, withKnownProviderCosts } from "./billing/provider-derived-pricing";
import { projectDomainStatus, verifyDomainEvidence } from "./domains/verification";
import { defaultPaymentMethod, listPaymentMethods, verifyNowPaymentsSignature } from "./payments/service";
import { validateProviderConnection } from "./providers/validation";
import { reasoningCapabilities } from "./providers/reasoning";
import { evaluateMediaReadiness, evaluateRouteReadiness, routeTargetMediaSupported, routeTargetPricingConfigured, routeTargetValidated } from "./providers/route-readiness";
import { runConversationQualityProbe } from "./conversation/quality-probe";
import type { SettlementJournal } from "./billing/settlement-journal";
import { listUnresolvedAttempts, resolveUnknownAttempt, resolveUnknownWorkloadAttempt } from "./billing/reconciliation";
export { SettlementJournal } from "./billing/settlement-journal";

interface Env {
  DB: D1Database;
  CONTEXT_CACHE?: KVNamespace;
  SETTLEMENT_JOURNAL: DurableObjectNamespace<SettlementJournal>;
  AI: {
    run(model: string, input: unknown): Promise<any>;
    toMarkdown(
      files: { name: string; blob: Blob } | Array<{ name: string; blob: Blob }>,
      options?: unknown,
    ): Promise<any>;
  };
  MEDIA: R2Bucket;
  MKETY_ASSIST_SECRET_ENCRYPTION_KEY: string;
  HOSTED_SUFFIX: string;
  PORTAL_CNAME_TARGET: string;
  ROUTING_ORIGIN: string;
  APP_WORKER_NAME: string;
  OPS_HOST: string;
  ENTRY_HOST: string;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_SECONDS: string;
  RECOVERY_TTL_SECONDS: string;
  OPS_SESSION_COOKIE_NAME: string;
  MKETY_ASSIST_OPS_AUTH_ISSUER: string;
  MKETY_ASSIST_OPS_AUTH_CLIENT_ID: string;
  MKETY_ASSIST_OPS_ALLOWED_EMAIL: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME?: string;
  MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET: string;
  MKETY_ASSIST_CF_ZONE_ID: string;
  MKETY_ASSIST_CF_ACCOUNT_ID: string;
  MKETY_ASSIST_CF_SAAS_TOKEN: string;
  FLUTTERWAVE_CHECKOUT_BROKER_SECRET?: string;
  FLUTTERWAVE_CHECKOUT_BROKER_URL?: string;
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  MKETY_ASSIST_DEPLOY_PROBE_SECRET?: string;
  MKETY_ASSIST_AZURE_FOUNDRY_API_KEY?: string;
  MKETY_ASSIST_AZURE_FOUNDRY_ENDPOINT?: string;
  MKETY_ASSIST_AZURE_FOUNDRY_MODEL?: string;
  MKETY_ASSIST_OPENAI_API_KEY?: string;
  MKETY_ASSIST_OPENAI_MODEL?: string;
  REPLY_QUEUE: {
    send(body: unknown, options?: { delaySeconds?: number }): Promise<void>;
  };
  INBOUND_QUEUE: { send(body: unknown): Promise<void> };
}

type CustomerContext = {
  customerId: string;
  customerSlug: string;
  customerName: string;
  hostname: string;
  brandColor?: string | null;
  logoUrl?: string | null;
};

type Session = {
  userId: string;
  customerId: string;
  role: "owner" | "admin" | "member";
  email: string;
};

const encoder = new TextEncoder();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();

      const assistantWebhook = await handleAssistantTelegramWebhook(request, env);
      if (assistantWebhook) return assistantWebhook;

      if (url.pathname === "/health") {
        return json({ ok: true, service: "mkety-assist", time: new Date().toISOString() });
      }

      if (url.pathname === "/api/internal/provider-bootstrap" && request.method === "POST") {
        return handleManagedProviderBootstrap(request, env);
      }
      if (url.pathname === "/api/internal/inference-acceptance" && request.method === "POST") {
        return handleInferenceAcceptance(request, env);
      }

      if (host === env.OPS_HOST) {
        return handleOps(request, env);
      }

      if (host === env.ENTRY_HOST) {
        if (url.pathname === "/" || url.pathname === "/login") return assistEntryPage(env.HOSTED_SUFFIX);
        return brandedNotFound(host);
      }

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/telegram/auth-webhook" && request.method === "POST") {
        return handleTelegramAuthBotWebhook(request, env);
      }

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/payment/flutterwave/webhook" && request.method === "POST") {
        return handleFlutterwavePaymentWebhook(request, env);
      }
      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/payment/nowpayments/webhook" && request.method === "POST") {
        return handleNowPaymentsPaymentWebhook(request, env);
      }
      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/payment/kora/webhook" && request.method === "POST") {
        return handleKoraPaymentWebhook(request, env);
      }

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/payment/return" && request.method === "GET") {
        return handlePaymentReturn(url, env);
      }

      const customer = await resolveCustomerByHost(env.DB, host, env.HOSTED_SUFFIX);
      if (!customer) return brandedNotFound(host);

      if (url.pathname === "/.well-known/mkety-assist-domain" && request.method === "GET") {
        return json({ service: "mkety-assist", hostname: host, owner: customer.customerSlug });
      }

      if (url.pathname.startsWith("/api/auth/")) {
        return handleAuth(request, env, customer);
      }

      if (url.pathname.startsWith("/v1/")) {
        const apiResponse = await handleApiKeyInference(request, env, customer);
        if (apiResponse) return apiResponse;
      }

      if (url.pathname === "/setup" && request.method === "GET") {
        return setupPage(customer, url.searchParams.get("token") || "");
      }

      const session = await requireSession(request, env, customer.customerId);
      if (url.pathname.startsWith("/api/")) {
        if (!session) return json({ error: "unauthorized" }, 401);
        return handleCustomerApi(request, env, customer, session);
      }

      if (!session) return loginPage(customer);
      return dashboardPage(customer, session);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      return runtimeErrorResponse(error);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await Promise.all([
      processDueReminders(env),
      recoverReplyJobs(env),
      inspectStaleAttemptProjections(env),
      syncTelegramBusinessWebhookCapabilities(env),
    ]);
  },

  async queue(batch: any, env: Env): Promise<void> {
    if (batch.queue === "mkety-assist-inbound") await processInboundQueue(batch, env);
    else await processReplyQueue(batch, env);
  },
};

function requireDeployProbe(request: Request, env: Env) {
  const expected = String(env.MKETY_ASSIST_DEPLOY_PROBE_SECRET || "");
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!expected || !supplied || !constantTimeEqual(supplied, expected)) throw new HttpError(404, "not_found");
}

async function upsertManagedProvider(env: Env, input: {
  id: string;
  name: string;
  provider: "azure-foundry" | "openai";
  endpointUrl: string | null;
  apiKey: string;
  model: string;
}) {
  const now = unix();
  const ciphertext = await protectStoredSecret(input.apiKey, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
  await env.DB.prepare(
    `INSERT INTO provider_connections
     (id,name,customer_id,provider,endpoint_url,api_key_ciphertext,extra_json,capabilities_json,ownership,status,validated_at,validation_error,created_at,updated_at,default_model)
     VALUES (?,?,?,?,?,?,?,?,'mkety','disabled',NULL,'bootstrap_validation_required',?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,provider=excluded.provider,endpoint_url=excluded.endpoint_url,
       api_key_ciphertext=excluded.api_key_ciphertext,default_model=excluded.default_model,
       ownership='mkety',customer_id=NULL,status='disabled',validated_at=NULL,
       validation_error='bootstrap_validation_required',updated_at=excluded.updated_at`,
  ).bind(
    input.id,input.name,null,input.provider,input.endpointUrl,ciphertext,"{}",
    '["text","vision","audio","tools"]',now,now,input.model,
  ).run();

  const result = await validateProviderConnection({
    provider: input.provider,
    endpointUrl: input.endpointUrl,
    apiKey: input.apiKey,
    model: input.model,
    extra: {},
  });
  await env.DB.prepare(
    "UPDATE provider_connections SET status=?,validated_at=?,validation_error=?,updated_at=? WHERE id=?",
  ).bind(
    result.ok ? "active" : "disabled",
    result.ok ? now : null,
    result.ok ? null : String(result.error || "provider_validation_failed"),
    now,input.id,
  ).run();
  return { id: input.id, provider: input.provider, model: input.model, ...result };
}

const AZURE_PRIMARY_PROMOTION_KEY = "assist.azure_primary.v1";

async function promoteManagedAzurePrimaryOnce(env: Env, azureModel: string) {
  const prior = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key=? LIMIT 1")
    .bind(AZURE_PRIMARY_PROMOTION_KEY).first<any>();
  if (prior) return { applied: false, reason: "already_recorded", aliases: [] as string[] };

  const connection = await env.DB.prepare(
    "SELECT id,status,validated_at FROM provider_connections WHERE id='prv_managed_azure_foundry' LIMIT 1",
  ).first<any>();
  if (!connection || connection.status !== "active" || !connection.validated_at) {
    return { applied: false, reason: "azure_not_validated", aliases: [] as string[] };
  }

  const aliases = ["mkety-fast", "mkety-smart", "mkety-reasoning", "mkety-vision", "mkety-media-vision"];
  const promoted: string[] = [];
  const now = unix();

  for (const alias of aliases) {
    const scopeKey = `global:${alias}`;
    const rows = await env.DB.prepare(
      "SELECT * FROM model_route_targets WHERE scope_key=? ORDER BY position ASC",
    ).bind(scopeKey).all<any>();
    const existing = rows.results ?? [];
    if (!existing.length) continue;

    const currentPrimary = existing.find((row: any) => Number(row.enabled) === 1) ?? existing[0];
    const pricingBase = currentPrimary;
    const reasoningBase = existing.find((row: any) =>
      row.reasoning_credits_per_million != null || row.provider_reasoning_cost_micros_per_million != null
    ) ?? pricingBase;
    const remaining = existing.filter((row: any) =>
      !(String(row.provider) === "azure-foundry" && String(row.provider_connection_id || "") === "prv_managed_azure_foundry")
    );

    const azureTarget = {
      ...pricingBase,
      scope_key: scopeKey,
      customer_id: null,
      alias,
      position: 0,
      provider: "azure-foundry",
      provider_model: azureModel,
      provider_connection_id: "prv_managed_azure_foundry",
      enabled: 1,
      created_at: now,
      updated_at: now,
      reasoning_capabilities_json: null,
      reasoning_credits_per_million: reasoningBase.reasoning_credits_per_million ?? null,
      provider_reasoning_cost_micros_per_million: reasoningBase.provider_reasoning_cost_micros_per_million ?? null,
    };
    const ordered = [azureTarget, ...remaining].slice(0, 10).map((row: any, index: number) => ({ ...row, position: index }));

    const statements: D1PreparedStatement[] = [
      env.DB.prepare("DELETE FROM model_route_targets WHERE scope_key=?").bind(scopeKey),
    ];
    for (const row of ordered) {
      statements.push(env.DB.prepare(
        `INSERT INTO model_route_targets
         (scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
          input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
          provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
          provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at,
          reasoning_capabilities_json,reasoning_credits_per_million,provider_reasoning_cost_micros_per_million)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        row.scope_key,row.customer_id ?? null,row.alias,row.position,row.provider,row.provider_model,row.provider_connection_id ?? null,Number(row.enabled ?? 1),
        Number(row.input_credits_per_million || 0),Number(row.output_credits_per_million || 0),Number(row.image_credits || 0),Number(row.audio_credits_per_minute || 0),
        Number(row.provider_input_cost_micros_per_million || 0),Number(row.provider_output_cost_micros_per_million || 0),
        Number(row.provider_image_cost_micros || 0),Number(row.provider_audio_cost_micros_per_minute || 0),
        Number(row.created_at || now),now,row.reasoning_capabilities_json ?? null,
        row.reasoning_credits_per_million == null ? null : Number(row.reasoning_credits_per_million),
        row.provider_reasoning_cost_micros_per_million == null ? null : Number(row.provider_reasoning_cost_micros_per_million),
      ));
    }
    const firstFallback = ordered.find((row: any, index: number) => index > 0 && Number(row.enabled) === 1) ?? null;
    statements.push(env.DB.prepare(
      `UPDATE model_routes
       SET provider='azure-foundry',provider_model=?,provider_connection_id='prv_managed_azure_foundry',
           fallback_provider=?,fallback_model=?,fallback_provider_connection_id=?,status='active',updated_at=?
       WHERE alias=?`,
    ).bind(
      azureModel,
      firstFallback?.provider ?? null,
      firstFallback?.provider_model ?? null,
      firstFallback?.provider_connection_id ?? null,
      now,
      alias,
    ));
    await env.DB.batch(statements);
    promoted.push(alias);
  }

  await env.DB.prepare(
    "INSERT INTO system_settings (key,value_json,updated_at) VALUES (?,?,?)",
  ).bind(
    AZURE_PRIMARY_PROMOTION_KEY,
    JSON.stringify({ appliedAt: now, provider: "azure-foundry", providerConnectionId: "prv_managed_azure_foundry", aliases: promoted }),
    now,
  ).run();
  return { applied: true, reason: "promoted", aliases: promoted };
}

async function generateAcceptanceReply(env: Env, target: any, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  return invokeProviderModel(
    env,
    target,
    { messages, max_tokens: 1024, temperature: 0.2 },
    "__mkety_acceptance__",
  );
}

async function handleManagedProviderBootstrap(request: Request, env: Env) {
  requireDeployProbe(request, env);
  const results: any[] = [];
  if (env.MKETY_ASSIST_AZURE_FOUNDRY_API_KEY && env.MKETY_ASSIST_AZURE_FOUNDRY_ENDPOINT && env.MKETY_ASSIST_AZURE_FOUNDRY_MODEL) {
    results.push(await upsertManagedProvider(env, {
      id: "prv_managed_azure_foundry",
      name: "Mkety Managed Azure Foundry",
      provider: "azure-foundry",
      endpointUrl: env.MKETY_ASSIST_AZURE_FOUNDRY_ENDPOINT,
      apiKey: env.MKETY_ASSIST_AZURE_FOUNDRY_API_KEY,
      model: env.MKETY_ASSIST_AZURE_FOUNDRY_MODEL,
    }));
  }
  if (env.MKETY_ASSIST_OPENAI_API_KEY && env.MKETY_ASSIST_OPENAI_MODEL) {
    results.push(await upsertManagedProvider(env, {
      id: "prv_managed_openai",
      name: "Mkety Managed OpenAI",
      provider: "openai",
      endpointUrl: "https://api.openai.com/v1",
      apiKey: env.MKETY_ASSIST_OPENAI_API_KEY,
      model: env.MKETY_ASSIST_OPENAI_MODEL,
    }));
  }
  let azurePrimary = { applied: false, reason: "azure_not_configured", aliases: [] as string[] };
  const azureResult = results.find((item: any) => item.provider === "azure-foundry");
  if (azureResult?.ok && env.MKETY_ASSIST_AZURE_FOUNDRY_MODEL) {
    azurePrimary = await promoteManagedAzurePrimaryOnce(env, env.MKETY_ASSIST_AZURE_FOUNDRY_MODEL);
  }
  return json({ ok: true, bootstrapped: results, azurePrimary });
}

function acceptanceText(result: any): string {
  const partText = (value: any): string => {
    if (typeof value === "string") return value.trim();
    if (!Array.isArray(value)) return "";
    return value.map((part: any) =>
      typeof part === "string" ? part
      : typeof part?.text === "string" ? part.text
      : typeof part?.output_text === "string" ? part.output_text
      : typeof part?.content === "string" ? part.content
      : ""
    ).join("").trim();
  };
  if (typeof result?.response === "string" && result.response.trim()) return result.response.trim();
  if (typeof result?.result?.response === "string" && result.result.response.trim()) return result.result.response.trim();
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  if (typeof result?.text === "string" && result.text.trim()) return result.text.trim();
  for (const choice of Array.isArray(result?.choices) ? result.choices : []) {
    const value = partText(choice?.message?.content) || (typeof choice?.text === "string" ? choice.text.trim() : "");
    if (value) return value;
  }
  const output = (Array.isArray(result?.output) ? result.output : [])
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((part: any) => typeof part?.text === "string" ? part.text : (typeof part?.output_text === "string" ? part.output_text : ""))
    .join("").trim();
  if (output) return output;
  for (const candidate of Array.isArray(result?.candidates) ? result.candidates : []) {
    const value = partText(candidate?.content?.parts);
    if (value) return value;
  }
  return "";
}

async function handleInferenceAcceptance(request: Request, env: Env) {
  requireDeployProbe(request, env);
  const results: any[] = [];
  const workerModels = [
    { role: "primary", model: "@cf/google/gemma-4-26b-a4b-it" },
    { role: "fallback", model: "@cf/zai-org/glm-5.3-flash" },
  ];
  for (const worker of workerModels) {
    try {
      const output = await env.AI.run(worker.model, {
        messages: [{ role: "user", content: "Reply only with MKETY_ASSIST_READY" }],
        max_completion_tokens: 256,
        reasoning_effort: "low",
      });
      const text = acceptanceText(output);
      results.push({ provider: "workers-ai", role: worker.role, model: worker.model, ok: text.length > 0, returnedText: text.slice(0,80) });
    } catch (error) {
      results.push({ provider: "workers-ai", role: worker.role, model: worker.model, ok: false, error: error instanceof Error ? error.message.slice(0,300) : String(error).slice(0,300) });
    }
  }

  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP8z0AaYCJR/aiGUQ1DSAMAQC4BH2bjRnMAAAAASUVORK5CYII=";
  for (const worker of workerModels) {
    try {
      const output = await env.AI.run(worker.model, {
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "An image is attached. Reply with a short acknowledgement of the image." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${tinyPng}` } },
          ],
        }],
        max_completion_tokens: 256,
        reasoning_effort: "low",
      });
      const text = acceptanceText(output);
      const usage = output?.usage || output?.result?.usage || null;
      results.push({
        provider: "workers-ai-vision",
        role: worker.role,
        model: worker.model,
        ok: text.length > 0,
        returnedText: text.slice(0,80),
        usageAvailable: Boolean(usage),
      });
    } catch (error) {
      results.push({ provider: "workers-ai-vision", role: worker.role, model: worker.model, ok: false, error: error instanceof Error ? error.message.slice(0,300) : String(error).slice(0,300) });
    }
  }

  for (const worker of workerModels) {
    try {
      const output = await env.AI.run(worker.model, {
        messages: [
          { role: "system", content: "You are a business assistant. Answer the customer's question using supplied image-analysis evidence." },
          { role: "user", content: "CUSTOMER MESSAGE: What is shown here?\nATTACHED IMAGE ANALYSIS: A small solid red square is visible.\nReply in one short sentence." },
        ],
        max_completion_tokens: 256,
        reasoning_effort: "low",
      });
      const text = acceptanceText(output);
      results.push({
        provider: "workers-ai-image-reply",
        role: worker.role,
        model: worker.model,
        ok: text.length > 0,
        returnedText: text.slice(0,100),
      });
    } catch (error) {
      results.push({ provider: "workers-ai-image-reply", role: worker.role, model: worker.model, ok: false, error: error instanceof Error ? error.message.slice(0,300) : String(error).slice(0,300) });
    }
  }

  const managed = await env.DB.prepare(
    `SELECT id,provider,endpoint_url,api_key_ciphertext,default_model,status,validation_error,extra_json
     FROM provider_connections
     WHERE ownership='mkety' AND provider IN ('azure-foundry','vertex','openai')
     ORDER BY CASE provider WHEN 'azure-foundry' THEN 1 WHEN 'vertex' THEN 2 ELSE 3 END,created_at DESC`,
  ).all<any>();
  const seenProvider = new Set<string>();
  for (const row of managed.results ?? []) {
    if (seenProvider.has(String(row.provider))) continue;
    seenProvider.add(String(row.provider));
    const apiKey = await revealStoredSecret(String(row.api_key_ciphertext), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
    const probe = await validateProviderConnection({
      provider: String(row.provider),
      endpointUrl: row.endpoint_url ? String(row.endpoint_url) : null,
      apiKey,
      model: row.default_model ? String(row.default_model) : null,
      extra: row.extra_json ? JSON.parse(String(row.extra_json)) : {},
    });
    const reachable = Boolean(probe.ok || (probe.credentialAccepted && probe.billingBlocked));
    results.push({ provider: row.provider, model: row.default_model, connectionStatus: row.status, reachable, ...probe });
  }

  const targetRows = await env.DB.prepare(
    `SELECT scope_key,alias,position,provider,provider_model,provider_connection_id,enabled,
            provider_input_cost_micros_per_million,provider_output_cost_micros_per_million
     FROM model_route_targets ORDER BY scope_key,position`,
  ).all<any>();
  const qualityTarget = (targetRows.results ?? []).find((target: any) =>
    target.scope_key === "global:mkety-smart" && Number(target.position) === 0 && Number(target.enabled) === 1
  ) ?? (targetRows.results ?? []).find((target: any) =>
    ["mkety-smart","mkety-fast","mkety-reasoning"].includes(String(target.alias)) && Number(target.enabled) === 1
  );
  const qualityModel = String(qualityTarget?.provider_model || workerModels[0].model);
  const qualityProvider = String(qualityTarget?.provider || "workers-ai");
  const qualityInputCost = Number(qualityTarget?.provider_input_cost_micros_per_million || 0);
  const qualityOutputCost = Number(qualityTarget?.provider_output_cost_micros_per_million || 0);
  const qualityCostRatesAvailable = Number.isFinite(qualityInputCost) && Number.isFinite(qualityOutputCost)
    && (qualityInputCost > 0 || qualityOutputCost > 0);
  const conversationQuality = qualityCostRatesAvailable && qualityTarget
    ? await runConversationQualityProbe({
        generate: async (messages) => {
          const inputChars = messages.reduce((sum, message) => sum + String(message.content || "").length, 0);
          const estimatedInputTokens = Math.max(1, Math.ceil(inputChars / 4));
          const estimatedMaximumCost = Math.ceil((estimatedInputTokens * qualityInputCost + 256 * qualityOutputCost) / 1_000_000);
          try {
            const output = await generateAcceptanceReply(env, qualityTarget, messages);
            const text = acceptanceText(output);
            const usage = output?.usage || output?.result?.usage || {};
            const reportedInputTokens = Number(usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens);
            const reportedOutputTokens = Number(usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens);
            const inputTokens = Number.isFinite(reportedInputTokens) && reportedInputTokens > 0 ? reportedInputTokens : estimatedInputTokens;
            const providerOutputTokens = Number.isFinite(reportedOutputTokens) && reportedOutputTokens >= 0 ? reportedOutputTokens : Math.max(1, Math.ceil(text.length / 4));
            const visibleOutputTokens = Math.max(0, Math.ceil(text.length / 4));
            const cost = Math.ceil((inputTokens * qualityInputCost + providerOutputTokens * qualityOutputCost) / 1_000_000);
            return { text, providerCostMicros: Math.max(estimatedMaximumCost, cost), outputTokens: visibleOutputTokens };
          } catch {
            return { text: "", providerCostMicros: estimatedMaximumCost, outputTokens: 256 };
          }
        },
      })
    : {
        ok: false,
        cases: [{ name: "provider_cost_rate", ok: false, detail: "No configured primary-route provider cost rates; synthetic probe skipped." }],
        providerCostMicros: 0,
      };
  const conversationQualityResult = {
    ...conversationQuality,
    provider: qualityProvider,
    model: qualityModel,
    costRatesAvailable: qualityCostRatesAvailable,
  };
  const workersOk = workerModels.every((worker) => results.some((item) => item.provider === "workers-ai" && item.model === worker.model && item.ok));
  const workersVisionOk = workerModels.every((worker) => results.some((item) => item.provider === "workers-ai-vision" && item.model === worker.model && item.ok));
  const workersImageReplyOk = workerModels.every((worker) => results.some((item) => item.provider === "workers-ai-image-reply" && item.model === worker.model && item.ok));
  const azureOk = results.some((item) => item.provider === "azure-foundry" && (item.ok || item.reachable));
  const vertexOk = results.some((item) => item.provider === "vertex" && (item.ok || item.reachable));
  const ok = workersOk && workersVisionOk && workersImageReplyOk && azureOk && vertexOk && conversationQualityResult.ok;
  return json({ ok, providers: results, routeTargets: targetRows.results ?? [], workersVisionOk, workersImageReplyOk, conversationQuality: conversationQualityResult, frontier: { azureFoundry: azureOk, vertex: vertexOk } }, ok ? 200 : 503);
}

async function handleOps(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/setup") {
    return Response.redirect(new URL("/", request.url).toString(), 302);
  }

  if (url.pathname === "/api/ops/auth/login" && request.method === "GET") {
    try {
      return await startOperatorOidc(request, env);
    } catch (error) {
      console.error("Assist Operator OIDC start failed", error);
      return html("<!doctype html><html><body style=\"font:16px system-ui;background:#0d0e14;color:white;padding:40px\"><h1>Operator sign-in unavailable</h1><p>Mkety authentication is temporarily unavailable.</p></body></html>", 503);
    }
  }

  if (url.pathname === "/api/ops/auth/callback" && request.method === "GET") {
    try {
      const email = await finishOperatorOidc(request, env);
      const now = unix();
      const existing = await env.DB.prepare(
        "SELECT id FROM operator_users WHERE email=? LIMIT 1",
      ).bind(email).first<any>();
      const operatorId = existing?.id || id("ops");
      if (existing?.id) {
        await env.DB.prepare(
          "UPDATE operator_users SET status='active',updated_at=? WHERE id=?",
        ).bind(now, operatorId).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO operator_users (id,email,password_hash,password_salt,password_iterations,status,created_at,updated_at) VALUES (?,?,NULL,NULL,310000,'active',?,?)",
        ).bind(operatorId, email, now, now).run();
      }
      return issueOperatorSessionRedirect(env, operatorId, email, new URL("/", request.url).toString());
    } catch (error) {
      console.error("Assist Operator OIDC callback failed", error);
      return html("<!doctype html><html><body style=\"font:16px system-ui;background:#0d0e14;color:white;padding:40px\"><h1>Sign-in failed</h1><p>This Mkety identity is not authorized for Assist Operator access.</p><p><a style=\"color:#9f8cff\" href=\"/\">Try again</a></p></body></html>", 403);
    }
  }

  if (url.pathname === "/api/ops/auth/setup" || (url.pathname === "/api/ops/auth/login" && request.method === "POST")) {
    return json({ error: "password_bootstrap_retired" }, 410);
  }

  if (url.pathname === "/api/ops/auth/logout" && request.method === "POST") {
    const token = getNamedCookie(request, env.OPS_SESSION_COOKIE_NAME);
    if (token) await env.DB.prepare("DELETE FROM operator_sessions WHERE token_hash=?").bind(await sha256(token)).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": clearNamedCookie(env.OPS_SESSION_COOKIE_NAME),
      },
    });
  }

  const operator = await requireOperatorSession(request, env);
  if (!operator) {
    if (url.pathname.startsWith("/api/ops/")) return json({ error: "unauthorized" }, 401);
    return operatorLoginPage();
  }

  if (url.pathname === "/api/ops/inference-attempts" && request.method === "GET") {
    const customerId = requiredString(url.searchParams.get("customerId"), "customerId");
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const cursorValue = Number(url.searchParams.get("cursor") || 0);
    const attempts = await listUnresolvedAttempts(env.DB, customerId, limit, cursorValue > 0 ? cursorValue : null);
    return json({ attempts });
  }

  if (url.pathname.startsWith("/api/ops/inference-attempts/") && url.pathname.endsWith("/resolve") && request.method === "POST") {
    const attemptId = decodeURIComponent(url.pathname.slice("/api/ops/inference-attempts/".length, -"/resolve".length));
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const outcome = String(body.outcome || "");
    if (!["confirmed_not_submitted", "recovered_result", "provider_charged_no_result", "mkety_absorbed_cost", "unresolved"].includes(outcome)) {
      return json({ error: "invalid_resolution_outcome" }, 400);
    }
    if (body.workloadType === "api_key") {
      const workloadId = requiredString(body.workloadId, "workloadId");
      const result = await resolveUnknownWorkloadAttempt(env.DB, env.SETTLEMENT_JOURNAL, {
        attemptId, customerId, workloadType: "api_key", workloadId, operatorUserId: operator.operatorUserId,
        outcome: outcome as any, idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
        evidenceSummary: requiredString(body.evidenceSummary, "evidenceSummary"),
        reason: requiredString(body.reason, "reason"),
        usage: body.usage && typeof body.usage === "object" ? {
          inputUnits: Number(body.usage.inputUnits), outputUnits: Number(body.usage.outputUnits),
          reasoningUnits: body.usage.reasoningUnits == null ? 0 : Number(body.usage.reasoningUnits),
          providerCostMicros: Number(body.usage.providerCostMicros), evidence: requiredString(body.usage.evidence, "usage.evidence"),
        } : undefined,
        absorbedProviderCost: body.absorbedProviderCost && typeof body.absorbedProviderCost === "object" ? {
          providerCostMicros: Number(body.absorbedProviderCost.providerCostMicros),
          evidence: requiredString(body.absorbedProviderCost.evidence, "absorbedProviderCost.evidence"),
        } : undefined,
      });
      return json({ outcome: result.outcome, idempotent: result.idempotent });
    }
    const assistantId = requiredString(body.assistantId, "assistantId");
    const result = await resolveUnknownAttempt(env.DB, env.SETTLEMENT_JOURNAL, {
      attemptId, customerId, assistantId, operatorUserId: operator.operatorUserId,
      outcome: outcome as any, idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
      evidenceSummary: requiredString(body.evidenceSummary, "evidenceSummary"),
      reason: requiredString(body.reason, "reason"),
      usage: body.usage && typeof body.usage === "object" ? {
        inputUnits: Number(body.usage.inputUnits), outputUnits: Number(body.usage.outputUnits),
        reasoningUnits: body.usage.reasoningUnits == null ? 0 : Number(body.usage.reasoningUnits),
        imageUnits: body.usage.imageUnits == null ? 0 : Number(body.usage.imageUnits),
        audioSeconds: body.usage.audioSeconds == null ? 0 : Number(body.usage.audioSeconds),
        providerCostMicros: Number(body.usage.providerCostMicros),
        evidence: requiredString(body.usage.evidence, "usage.evidence"),
      } : undefined,
      absorbedProviderCost: body.absorbedProviderCost && typeof body.absorbedProviderCost === "object" ? {
        providerCostMicros: Number(body.absorbedProviderCost.providerCostMicros),
        evidence: requiredString(body.absorbedProviderCost.evidence, "absorbedProviderCost.evidence"),
      } : undefined,
    });
    if (result.outcome === "recovered_result" && result.replyJobId && result.recoveredText) {
      const now = unix();
      await env.DB.prepare(
        "UPDATE reply_jobs SET response_text=?,status='retry',due_at=?,last_enqueued_at=NULL,locked_at=NULL,updated_at=? WHERE id=? AND customer_id=? AND assistant_id=? AND status!='delivered'",
      ).bind(result.recoveredText, now, now, result.replyJobId, customerId, assistantId).run();
      await env.REPLY_QUEUE.send({ jobId: result.replyJobId });
    } else if (["provider_charged_no_result", "mkety_absorbed_cost"].includes(result.outcome) && result.replyJobId) {
      const now = unix();
      await env.DB.prepare(
        "UPDATE reply_jobs SET response_text=?,status='retry',due_at=?,last_enqueued_at=NULL,locked_at=NULL,updated_at=? WHERE id=? AND customer_id=? AND assistant_id=? AND status!='delivered'",
      ).bind("I couldn’t recover the answer. Please send your message again.", now, now, result.replyJobId, customerId, assistantId).run();
      await env.REPLY_QUEUE.send({ jobId: result.replyJobId });
    }
    return json({ outcome: result.outcome, released: result.released, settled: result.settled, idempotent: result.idempotent });
  }

  if (url.pathname === "/" && request.method === "GET") return opsPage([]);

  if (url.pathname === "/api/ops/customers" && request.method === "POST") {
    const body = await readJson(request);
    const name = requiredString(body.name, "name");
    const slug = normalizeSlug(requiredString(body.slug, "slug"));
    const adminEmail = normalizeEmail(requiredString(body.adminEmail, "adminEmail"));
    const customHostname = optionalHostname(body.customHostname);
    const now = unix();
    const customerId = id("cus");
    const userId = id("usr");
    const setupToken = randomToken(32);
    const setupHash = await sha256(setupToken);
    const setupCiphertext = await protectStoredSecret(setupToken, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
    const hostedHostname = `${slug}.${env.HOSTED_SUFFIX}`;

    const monthlyPrice = parseUsdMinorValue(body.monthlyPriceUsd, "monthly price");
    const fundingMode = String(body.fundingMode || "full_period") === "prepaid_partial" ? "prepaid_partial" : "full_period";
    const minimumFundingMinor = fundingMode === "prepaid_partial"
      ? parseUsdMinorValue(body.minimumFundingUsd || body.monthlyPriceUsd, "minimum funding")
      : monthlyPrice;
    if (minimumFundingMinor > monthlyPrice) return json({ error: "minimum_funding_exceeds_monthly_price" }, 400);
    const setupFeeMinor = parseUsdMinorValue(body.setupFeeUsd ?? "0", "setup fee", true);
    const providerEnvelopeBps = parsePercentBpsValue(body.managedCostSharePercent, 15, 0.01, 100);
    const operationsReserveBps = parsePercentBpsValue(body.operationsReservePercent, 10, 0, 99.99);
    const rateMultiplierBps = parsePercentBpsValue(body.customerRateMultiplierPercent, 100, 100, 1000);
    const mediaRateMultiplierBps = parsePercentBpsValue(body.customerMediaRateMultiplierPercent, rateMultiplierBps / 100, 1, 1000);
    const autoIncludedCredits = String(body.autoIncludedCredits ?? "yes") !== "no";
    let includedCredits = creditAtomsFromMkredits(body.includedCredits);
    if (autoIncludedCredits && monthlyPrice > 0) {
      includedCredits = calculateCommercialPlan({
        monthlyAmountMinor: monthlyPrice,
        providerEnvelopeBps,
        operationsReserveBps,
        rateMultiplierBps,
      }).includedCredits;
    }
    const maxAssistants = Math.max(1, positiveInt(body.maxAssistants, 5));

    await ensureHostedWorkerDomain(env, hostedHostname);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO customers (id,slug,name,status,billing_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
        .bind(customerId, slug, name, "active", "pending", now, now),
      env.DB.prepare("INSERT INTO customer_domains (id,customer_id,hostname,kind,is_primary,status,ssl_status,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id("dom"), customerId, hostedHostname, "hosted", customHostname ? 0 : 1, "active", "active", now, now),
      env.DB.prepare("INSERT INTO users (id,email,status,created_at,updated_at) VALUES (?,?,?,?,?)")
        .bind(userId, adminEmail, "active", now, now),
      env.DB.prepare("INSERT INTO customer_users (customer_id,user_id,role,created_at) VALUES (?,?,?,?)")
        .bind(customerId, userId, "owner", now),
      env.DB.prepare("INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at,token_ciphertext) VALUES (?,?,?,?,?,?,?)")
        .bind(id("set"), customerId, userId, setupHash, now + 86400, now, setupCiphertext),
      env.DB.prepare("INSERT INTO credit_accounts (customer_id,balance,lifetime_granted,lifetime_consumed,updated_at) VALUES (?,?,?,?,?)")
        .bind(customerId, 0, 0, 0, now),
      env.DB.prepare("INSERT INTO commercial_policy (customer_id,subscription_amount_minor,included_credits,provider_envelope_bps,operations_reserve_bps,rate_multiplier_bps,media_rate_multiplier_bps,funding_mode,minimum_funding_minor,setup_fee_minor,credit_rollover,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(customerId, monthlyPrice, includedCredits, providerEnvelopeBps, operationsReserveBps, rateMultiplierBps, mediaRateMultiplierBps, fundingMode, minimumFundingMinor, setupFeeMinor, 1, now),
      env.DB.prepare("INSERT INTO feature_policy (customer_id,max_assistants,updated_at) VALUES (?,?,?)")
        .bind(customerId, maxAssistants, now),
      env.DB.prepare("INSERT INTO audit_events (id,actor_type,action,target_type,target_id,customer_id,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id("aud"), "operator", "customer.created", "customer", customerId, customerId, now),
    ]);

    let customDomain: unknown = null;
    let customDomainError: string | null = null;
    if (customHostname) {
      try {
        customDomain = await createCustomHostname(env, customerId, customHostname);
      } catch (error) {
        customDomainError = error instanceof Error ? error.message : String(error);
        console.error("Assist custom domain provisioning deferred", {
          customerId,
          hostname: customHostname,
          error: customDomainError,
        });
      }
    }

    return json({
      customerId,
      hostedHostname,
      customDomain,
      customDomainError,
      setupUrl: `https://${hostedHostname}/setup?token=${encodeURIComponent(setupToken)}`,
    }, 201);
  }

  if (url.pathname === "/api/ops/customer/access-link" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const now = unix();
    const row = await env.DB.prepare(
      `SELECT c.id,c.name,c.slug,u.id AS user_id,u.email,d.hostname
       FROM customers c
       JOIN customer_users cu ON cu.customer_id=c.id AND cu.role='owner'
       JOIN users u ON u.id=cu.user_id
       JOIN customer_domains d ON d.customer_id=c.id AND d.kind='hosted'
       WHERE c.id=? ORDER BY cu.created_at ASC LIMIT 1`,
    ).bind(customerId).first<any>();
    if (!row) return json({ error: "customer_owner_not_found" }, 404);

    await ensureHostedWorkerDomain(env, row.hostname);
    const token = randomToken(32);
    const tokenHash = await sha256(token);
    const tokenCiphertext = await protectStoredSecret(token, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
    await env.DB.batch([
      env.DB.prepare("UPDATE setup_tokens SET consumed_at=? WHERE customer_id=? AND consumed_at IS NULL")
        .bind(now, customerId),
      env.DB.prepare("INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at,token_ciphertext) VALUES (?,?,?,?,?,?,?)")
        .bind(id("set"), customerId, row.user_id, tokenHash, now + 86400, now, tokenCiphertext),
      env.DB.prepare(
        "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ).bind(
        id("aud"), "operator", operator.operatorUserId, customerId,
        "customer.owner_access_regenerated", "user", row.user_id,
        JSON.stringify({ email: row.email }), now,
      ),
    ]);
    return json({
      ok: true,
      email: row.email,
      hostedHostname: row.hostname,
      accessUrl: `https://${row.hostname}/setup?token=${encodeURIComponent(token)}`,
      expiresAt: now + 86400,
    });
  }

  if (url.pathname === "/api/ops/customer" && request.method === "DELETE") {
    const customerId = requiredString(url.searchParams.get("id"), "id");
    const customer = await env.DB.prepare(
      "SELECT id,slug,name,billing_status FROM customers WHERE id=? LIMIT 1",
    ).bind(customerId).first<any>();
    if (!customer) return json({ error: "customer_not_found" }, 404);

    const eligibility = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM payment_checkouts WHERE customer_id=? AND status='paid') AS paid_checkouts,
         (SELECT COUNT(*) FROM usage_events WHERE customer_id=?) AS usage_events,
         COALESCE((SELECT lifetime_consumed FROM credit_accounts WHERE customer_id=?),0) AS lifetime_consumed`,
    ).bind(customerId, customerId, customerId).first<any>();
    const paid = Number(eligibility?.paid_checkouts || 0);
    const usage = Number(eligibility?.usage_events || 0);
    const consumed = Number(eligibility?.lifetime_consumed || 0);
    if (paid > 0 || usage > 0 || consumed > 0) {
      return json({
        error: "customer_delete_blocked",
        reason: "Paid or used customers cannot be deleted. Disable/pause them instead.",
        paidCheckouts: paid,
        usageEvents: usage,
        lifetimeConsumed: consumed,
      }, 409);
    }

    const domains = await env.DB.prepare(
      "SELECT hostname,kind,provider_hostname_id FROM customer_domains WHERE customer_id=?",
    ).bind(customerId).all<any>();
    for (const domain of domains.results ?? []) {
      if (domain.kind === "custom") {
        await deleteCustomHostnameInfrastructure(env, String(domain.hostname), domain.provider_hostname_id ? String(domain.provider_hostname_id) : null);
      } else if (domain.kind === "hosted") {
        await deleteHostedWorkerDomain(env, String(domain.hostname));
      }
    }
    await deleteCustomerR2Objects(env.MEDIA, customerId);

    const members = await env.DB.prepare(
      "SELECT user_id FROM customer_users WHERE customer_id=?",
    ).bind(customerId).all<any>();
    const now = unix();
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      id("aud"), "operator", operator.operatorUserId, customerId,
      "customer.deleted_unpaid", "customer", customerId,
      JSON.stringify({ slug: customer.slug, name: customer.name }), now,
    ).run();

    await env.DB.prepare("DELETE FROM customers WHERE id=?").bind(customerId).run();

    for (const member of members.results ?? []) {
      await env.DB.prepare(
        "DELETE FROM users WHERE id=? AND NOT EXISTS (SELECT 1 FROM customer_users WHERE user_id=?)",
      ).bind(member.user_id, member.user_id).run();
    }

    return json({ ok: true, deletedCustomerId: customerId, slug: customer.slug });
  }

  if (url.pathname === "/api/ops/domains" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const hostname = normalizeHostname(requiredString(body.hostname, "hostname"));
    return json(await createCustomHostname(env, customerId, hostname), 201);
  }

  if (url.pathname === "/api/ops/customers" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT c.*,ca.balance FROM customers c LEFT JOIN credit_accounts ca ON ca.customer_id=c.id ORDER BY c.created_at DESC",
    ).all();
    return json({ customers: (rows.results ?? []).map((row: any) => ({ ...row, balance: mkreditsFromCreditAtoms(row.balance) })) });
  }

  if (url.pathname === "/api/ops/customer" && request.method === "GET") {
    const customerId = requiredString(url.searchParams.get("id"), "id");
    const customer = await env.DB.prepare("SELECT * FROM customers WHERE id=? LIMIT 1").bind(customerId).first();
    if (!customer) return json({ error: "customer_not_found" }, 404);
    const commercial = await env.DB.prepare("SELECT * FROM commercial_policy WHERE customer_id=?").bind(customerId).first();
    const features = await env.DB.prepare("SELECT * FROM feature_policy WHERE customer_id=?").bind(customerId).first();
    const credits = await env.DB.prepare("SELECT * FROM credit_accounts WHERE customer_id=?").bind(customerId).first();
    const domains = await env.DB.prepare("SELECT hostname,kind,is_primary,status,ssl_status,validation_json,verified_at FROM customer_domains WHERE customer_id=? ORDER BY is_primary DESC,created_at ASC").bind(customerId).all();
    const members = await env.DB.prepare(
      `SELECT u.id,u.email,u.display_name,u.telegram_username,u.status,cu.role,
              COALESCE(ac.state,'active') AS control_state,ac.reason AS control_reason,ac.expires_at AS control_expires_at
       FROM customer_users cu
       JOIN users u ON u.id=cu.user_id
       LEFT JOIN account_controls ac ON ac.customer_id=cu.customer_id AND ac.user_id=cu.user_id
       WHERE cu.customer_id=? ORDER BY cu.created_at ASC`,
    ).bind(customerId).all();
    const senderControls = await env.DB.prepare(
      `SELECT sc.assistant_id,a.name AS assistant_name,sc.channel,sc.sender_id,sc.state,sc.reason,sc.expires_at,sc.updated_at
       FROM channel_sender_controls sc
       JOIN assistants a ON a.id=sc.assistant_id
       WHERE sc.customer_id=? AND sc.state!='active'
       ORDER BY sc.updated_at DESC LIMIT 200`,
    ).bind(customerId).all();
    const ownerAccess = await env.DB.prepare(
      `SELECT st.token_ciphertext,st.expires_at,u.email,d.hostname
       FROM setup_tokens st
       JOIN customer_users cu ON cu.customer_id=st.customer_id AND cu.user_id=st.user_id AND cu.role='owner'
       JOIN users u ON u.id=st.user_id
       JOIN customer_domains d ON d.customer_id=st.customer_id AND d.kind='hosted'
       WHERE st.customer_id=? AND st.consumed_at IS NULL AND st.expires_at>? AND st.token_ciphertext IS NOT NULL
       ORDER BY st.created_at DESC LIMIT 1`,
    ).bind(customerId, unix()).first<any>();
    let activeOwnerAccess: any = null;
    if (ownerAccess?.token_ciphertext) {
      try {
        const raw = await revealStoredSecret(String(ownerAccess.token_ciphertext), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
        activeOwnerAccess = {
          email: ownerAccess.email,
          accessUrl: `https://${ownerAccess.hostname}/setup?token=${encodeURIComponent(raw)}`,
          expiresAt: Number(ownerAccess.expires_at),
        };
      } catch (error) {
        console.error("Could not reveal active owner access token", error);
      }
    }
    return json({
      customer,
      commercial: commercial ? { ...(commercial as any), included_credits: mkreditsFromCreditAtoms((commercial as any).included_credits) } : commercial,
      features,
      credits: credits ? { ...(credits as any), balance: mkreditsFromCreditAtoms((credits as any).balance), lifetime_granted: mkreditsFromCreditAtoms((credits as any).lifetime_granted), lifetime_consumed: mkreditsFromCreditAtoms((credits as any).lifetime_consumed) } : credits,
      domains: domains.results ?? [],
      members: members.results ?? [],
      senderControls: senderControls.results ?? [],
      ownerAccess: activeOwnerAccess,
    });
  }

  if (url.pathname === "/api/ops/user-control" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const userId = requiredString(body.userId, "userId");
    const state = normalizeControlState(body.state);
    const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;
    const expiresAt = normalizeOptionalExpiry(body.expiresAt);
    const membership = await env.DB.prepare(
      "SELECT 1 FROM customer_users WHERE customer_id=? AND user_id=? LIMIT 1",
    ).bind(customerId, userId).first();
    if (!membership) return json({ error: "user_membership_not_found" }, 404);
    await setAccountControl(env.DB, {
      customerId, userId, state, reason, expiresAt, operatorId: operator.operatorUserId,
    });
    if (state !== "active") {
      await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE customer_id=? AND user_id=? AND revoked_at IS NULL")
        .bind(unix(), customerId, userId).run();
    }
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      id("aud"), "operator", operator.operatorUserId, customerId,
      "user.control." + state, "user", userId,
      JSON.stringify({ reason, expiresAt }), unix(),
    ).run();
    return json({ ok: true, state, reason, expiresAt });
  }

  if (url.pathname === "/api/ops/sender-control" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const assistantId = requiredString(body.assistantId, "assistantId");
    const channel = requiredString(body.channel, "channel").toLowerCase();
    const senderId = requiredString(body.senderId, "senderId");
    const state = normalizeControlState(body.state);
    const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;
    const expiresAt = normalizeOptionalExpiry(body.expiresAt);
    const assistant = await env.DB.prepare("SELECT 1 FROM assistants WHERE id=? AND customer_id=? LIMIT 1")
      .bind(assistantId, customerId).first();
    if (!assistant) return json({ error: "assistant_not_found" }, 404);
    await setSenderControl(env.DB, {
      customerId, assistantId, channel, senderId, state, reason, expiresAt, operatorId: operator.operatorUserId,
    });
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      id("aud"), "operator", operator.operatorUserId, customerId,
      "sender.control." + state, "channel_sender", senderId,
      JSON.stringify({ assistantId, channel, reason, expiresAt }), unix(),
    ).run();
    return json({ ok: true, state, reason, expiresAt });
  }

  if (url.pathname === "/api/ops/credits" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const publicDelta = Number(body.delta ?? 0);
    if (!Number.isFinite(publicDelta) || publicDelta === 0) return json({ error: "credit_delta_must_be_nonzero" }, 400);
    const delta = Math.round(publicDelta * CREDIT_ATOMS_PER_MKREDIT);
    const reason = requiredString(body.reason, "reason").slice(0, 300);
    const account = await env.DB.prepare("SELECT balance FROM credit_accounts WHERE customer_id=? LIMIT 1").bind(customerId).first<any>();
    if (!account) return json({ error: "credit_account_not_found" }, 404);
    const next = parseInt(String(account.balance || 0), 10) + delta;
    if (next < 0) return json({ error: "credit_adjustment_would_go_negative" }, 409);
    const now = unix();
    const ledgerId = id("led");
    const auditId = id("aud");
    const adjustmentResults = await env.DB.batch([
      env.DB.prepare(
        `UPDATE credit_accounts
         SET balance=balance+?,
             lifetime_granted=lifetime_granted+CASE WHEN ?>0 THEN ? ELSE 0 END,
             lifetime_consumed=lifetime_consumed+CASE WHEN ?>0 THEN 0 ELSE -? END,
             updated_at=?
         WHERE customer_id=? AND balance+?>=0`,
      ).bind(delta, delta, delta, delta, delta, now, customerId, delta),
      env.DB.prepare(
        `INSERT INTO credit_ledger (id,customer_id,delta,kind,reference_id,balance_after,metadata_json,created_at)
         SELECT ?,customer_id,?,?,NULL,balance,?,? FROM credit_accounts
         WHERE customer_id=? AND changes()=1`,
      ).bind(ledgerId, delta, "operator_adjustment", JSON.stringify({ reason }), now, customerId),
      env.DB.prepare(
        `INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at)
         SELECT ?, 'operator', ?, ?, 'credits.adjusted', 'customer', ?,
           json_object('delta',?,'reason',?,'balanceAfter',(SELECT balance FROM credit_accounts WHERE customer_id=?)), ?
         WHERE changes()=1`,
      ).bind(auditId, operator.operatorUserId, customerId, customerId, delta, reason, customerId, now),
    ]);
    if (!Number(adjustmentResults[0]?.meta?.changes || 0)) {
      return json({ error: "credit_adjustment_would_go_negative" }, 409);
    }
    const updated = await env.DB.prepare("SELECT balance,lifetime_consumed FROM credit_accounts WHERE customer_id=? LIMIT 1")
      .bind(customerId).first<any>();
    return json({
      ok: true,
      balance: mkreditsFromCreditAtoms(Number(updated?.balance || 0)),
      used: mkreditsFromCreditAtoms(Number(updated?.lifetime_consumed || 0)),
    });
  }

  if (url.pathname === "/api/ops/ledger" && request.method === "GET") {
    const customerId = requiredString(url.searchParams.get("customerId"), "customerId");
    const rows = await env.DB.prepare(
      "SELECT id,delta,kind,reference_id,balance_after,metadata_json,created_at FROM credit_ledger WHERE customer_id=? ORDER BY created_at DESC LIMIT 200",
    ).bind(customerId).all();
    return json({ entries: rows.results ?? [] });
  }

  if (url.pathname === "/api/ops/pricing/calculate" && request.method === "POST") {
    const body = await readJson(request);
    const result = calculateCommercialPlan({
      monthlyAmountMinor: parseUsdMinorValue(body.monthlyPriceUsd, "monthly price"),
      providerEnvelopeBps: parsePercentBpsValue(body.managedCostSharePercent, 15, 0.01, 100),
      operationsReserveBps: parsePercentBpsValue(body.operationsReservePercent, 10, 0, 99.99),
      rateMultiplierBps: parsePercentBpsValue(body.customerRateMultiplierPercent, 100, 100, 1000),
    });
    return json({ ...result, includedCredits: result.includedMkredits, mkreditsPerUsd: MKREDITS_PER_USD, creditUnit: "MKredit" });
  }

  if (url.pathname === "/api/ops/policy" && request.method === "PATCH") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const now = unix();
    let includedCreditsValue = body.includedCredits === undefined || body.includedCredits === null || body.includedCredits === "" ? null : creditAtomsFromMkredits(body.includedCredits);
    if (body.autoCalculateCredits === true) {
      const current = await env.DB.prepare("SELECT * FROM commercial_policy WHERE customer_id=? LIMIT 1").bind(customerId).first<any>();
      if (!current) return json({ error: "commercial_policy_not_found" }, 404);
      includedCreditsValue = calculateCommercialPlan({
        monthlyAmountMinor: body.monthlyPriceUsd === undefined
          ? (body.subscriptionAmountMinor === undefined ? Number(current.subscription_amount_minor) : positiveInt(body.subscriptionAmountMinor, 0))
          : parseUsdMinorValue(body.monthlyPriceUsd, "monthly price"),
        providerEnvelopeBps: body.managedCostSharePercent === undefined
          ? (body.providerEnvelopeBps === undefined ? Number(current.provider_envelope_bps) : positiveInt(body.providerEnvelopeBps, 0))
          : parsePercentBpsValue(body.managedCostSharePercent, 15, 0.01, 100),
        operationsReserveBps: body.operationsReservePercent === undefined
          ? (body.operationsReserveBps === undefined ? Number(current.operations_reserve_bps) : positiveInt(body.operationsReserveBps, 0))
          : parsePercentBpsValue(body.operationsReservePercent, 10, 0, 99.99),
        rateMultiplierBps: body.customerRateMultiplierPercent === undefined
          ? (body.rateMultiplierBps === undefined ? Number(current.rate_multiplier_bps) : positiveInt(body.rateMultiplierBps, 10000))
          : parsePercentBpsValue(body.customerRateMultiplierPercent, 100, 100, 1000),
      }).includedCredits;
    }
    await env.DB.batch([
      env.DB.prepare(`UPDATE commercial_policy SET
        subscription_amount_minor=COALESCE(?,subscription_amount_minor),
        included_credits=COALESCE(?,included_credits),
        provider_envelope_bps=COALESCE(?,provider_envelope_bps),
        operations_reserve_bps=COALESCE(?,operations_reserve_bps),
        rate_multiplier_bps=COALESCE(?,rate_multiplier_bps),
        media_rate_multiplier_bps=COALESCE(?,media_rate_multiplier_bps),
        funding_mode=COALESCE(?,funding_mode),
        minimum_funding_minor=COALESCE(?,minimum_funding_minor),
        setup_fee_minor=COALESCE(?,setup_fee_minor),
        credit_rollover=COALESCE(?,credit_rollover),
        hard_stop_enabled=COALESCE(?,hard_stop_enabled),
        topup_enabled=COALESCE(?,topup_enabled),
        updated_at=? WHERE customer_id=?`)
        .bind(
          body.monthlyPriceUsd === undefined ? nullableInt(body.subscriptionAmountMinor) : parseUsdMinorValue(body.monthlyPriceUsd, "monthly price"), includedCreditsValue,
          body.managedCostSharePercent === undefined ? nullableInt(body.providerEnvelopeBps) : parsePercentBpsValue(body.managedCostSharePercent, 15, 0.01, 100),
          body.operationsReservePercent === undefined ? nullableInt(body.operationsReserveBps) : parsePercentBpsValue(body.operationsReservePercent, 10, 0, 99.99),
          body.customerRateMultiplierPercent === undefined ? nullableInt(body.rateMultiplierBps) : parsePercentBpsValue(body.customerRateMultiplierPercent, 100, 100, 1000),
          body.customerMediaRateMultiplierPercent === undefined ? nullableInt(body.mediaRateMultiplierBps) : parsePercentBpsValue(body.customerMediaRateMultiplierPercent, 100, 1, 1000),
          body.fundingMode === undefined ? null : (String(body.fundingMode) === "prepaid_partial" ? "prepaid_partial" : "full_period"),
          body.minimumFundingUsd === undefined ? null : parseUsdMinorValue(body.minimumFundingUsd, "minimum funding"),
          body.setupFeeUsd === undefined ? null : parseUsdMinorValue(body.setupFeeUsd, "setup fee", true),
          body.creditRollover === undefined ? null : (body.creditRollover ? 1 : 0),
          nullableBoolInt(body.hardStopEnabled),
          nullableBoolInt(body.topupEnabled), now, customerId,
        ),
      env.DB.prepare(`UPDATE feature_policy SET
        telegram_enabled=COALESCE(?,telegram_enabled),
        vision_enabled=COALESCE(?,vision_enabled),
        voice_enabled=COALESCE(?,voice_enabled),
        knowledge_enabled=COALESCE(?,knowledge_enabled),
        reminders_enabled=COALESCE(?,reminders_enabled),
        human_handoff_enabled=COALESCE(?,human_handoff_enabled),
        tools_enabled=COALESCE(?,tools_enabled),
        vm_models_enabled=COALESCE(?,vm_models_enabled),
        max_assistants=COALESCE(?,max_assistants),
        updated_at=? WHERE customer_id=?`)
        .bind(
          nullableBoolInt(body.telegramEnabled), nullableBoolInt(body.visionEnabled),
          nullableBoolInt(body.voiceEnabled), nullableBoolInt(body.knowledgeEnabled),
          nullableBoolInt(body.remindersEnabled), nullableBoolInt(body.humanHandoffEnabled),
          nullableBoolInt(body.toolsEnabled), nullableBoolInt(body.vmModelsEnabled),
          nullableInt(body.maxAssistants), now, customerId,
        ),
      env.DB.prepare("INSERT INTO audit_events (id,actor_type,customer_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id("aud"), "operator", customerId, "policy.updated", "customer", customerId, now),
    ]);
    return json({ ok: true, includedCredits: includedCreditsValue == null ? null : mkreditsFromCreditAtoms(includedCreditsValue) });
  }

  if (url.pathname === "/api/ops/models" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT r.*,
         mr.version AS rate_version,
         mr.input_credits_per_million,
         mr.output_credits_per_million,
         mr.image_credits,
         mr.audio_credits_per_minute,
         mr.provider_input_cost_micros_per_million,
         mr.provider_output_cost_micros_per_million,
         mr.provider_image_cost_micros,
         mr.provider_audio_cost_micros_per_minute,
         mr.effective_at,
         rl.requests_per_second,
         rl.requests_per_minute,
         rl.tokens_per_minute,
         rl.retry_base_seconds,
         rl.retry_max_seconds
       FROM model_routes r
       LEFT JOIN model_rates mr ON mr.id=(
         SELECT id FROM model_rates x WHERE x.alias=r.alias ORDER BY x.version DESC LIMIT 1
       )
       LEFT JOIN model_runtime_limits rl ON rl.scope_key=('global:' || r.alias)
       ORDER BY r.alias`,
    ).all<any>();
    const targets = await env.DB.prepare(
      `SELECT t.*,pc.status AS provider_connection_status,pc.validated_at AS provider_connection_validated_at
       FROM model_route_targets t LEFT JOIN provider_connections pc ON pc.id=t.provider_connection_id
       WHERE t.customer_id IS NULL ORDER BY t.alias,t.position`,
    ).all<any>();
    const byAlias = new Map<string, any[]>();
    for (const target of targets.results ?? []) {
      const key=String(target.alias);
      const list=byAlias.get(key) ?? [];
      let configuredCapabilities: string[] = [];
      try { configuredCapabilities = JSON.parse(String(target.reasoning_capabilities_json || "[]")); } catch {}
      list.push({
        ...publicCreditFields(target),
        validated: routeTargetValidated(target),
        priced: routeTargetPricingConfigured(target, key),
        supported: routeTargetMediaSupported(target, key),
        reasoning_capabilities: reasoningCapabilities(String(target.provider), String(target.provider_model), configuredCapabilities),
      });
      byAlias.set(key,list);
    }
    const models = (rows.results ?? []).map((row: any) => {
      const modelTargets = byAlias.get(String(row.alias)) ?? [];
      const targetsForReadiness = modelTargets.length ? modelTargets : [{
        provider: row.provider, provider_model: row.provider_model, enabled: row.status === "active" ? 1 : 0,
        validated: routeTargetValidated(row), priced: routeTargetPricingConfigured(row, String(row.alias)),
        supported: routeTargetMediaSupported(row, String(row.alias)),
        reasoning_capabilities: reasoningCapabilities(String(row.provider), String(row.provider_model), []),
      }];
      return {
        ...publicCreditFields(row),
        targets: modelTargets,
        route_readiness: evaluateRouteReadiness(String(row.status || "disabled"), targetsForReadiness.map((target: any) => ({
          enabled: target.enabled, validated: target.validated, priced: target.priced, supported: target.supported,
          reasoningCapabilities: target.reasoning_capabilities,
        }))),
      };
    });
    const mediaFeatures = await env.DB.prepare(
      `SELECT c.id AS customer_id,c.name AS customer_name,fp.vision_enabled,fp.voice_enabled
       FROM customers c LEFT JOIN feature_policy fp ON fp.customer_id=c.id ORDER BY c.name`,
    ).all<any>();
    const mediaOverrides = await env.DB.prepare(
      `SELECT r.customer_id AS override_customer_id,r.alias AS override_alias,r.status AS override_status,
              t.*,pc.status AS provider_connection_status,pc.validated_at AS provider_connection_validated_at
       FROM customer_model_routes r
       LEFT JOIN model_route_targets t ON t.scope_key=('customer:' || r.customer_id || ':' || r.alias)
       LEFT JOIN provider_connections pc ON pc.id=t.provider_connection_id
       WHERE r.alias IN ('mkety-media-vision','mkety-media-speech') ORDER BY r.customer_id,t.position`,
    ).all<any>();
    const overrideByCustomer = new Map<string, any>();
    for (const row of mediaOverrides.results ?? []) {
      const key = `${row.override_customer_id}:${row.override_alias}`;
      const entry = overrideByCustomer.get(key) ?? { status: row.override_status, targets: [] };
      if (row.provider && row.provider_model) {
        entry.targets.push({
          ...row,
          validated: routeTargetValidated(row),
          priced: routeTargetPricingConfigured(row, String(row.alias)),
          supported: routeTargetMediaSupported(row, String(row.alias)),
        });
      }
      overrideByCustomer.set(key, entry);
    }
    const mediaReadiness = Object.fromEntries(["mkety-media-vision", "mkety-media-speech"].map((alias) => {
      const model = models.find((item: any) => item.alias === alias);
      const targetsForReadiness = model?.targets ?? [];
      const aliasStatus = String(model?.status || "disabled");
      const isVision = alias === "mkety-media-vision";
      return [alias, {
        ...evaluateRouteReadiness(aliasStatus, targetsForReadiness.map((target: any) => ({
          enabled: target.enabled, validated: target.validated, priced: target.priced, supported: target.supported,
        }))),
        customers: (mediaFeatures.results ?? []).map((customer: any) => {
          const override = overrideByCustomer.get(`${customer.customer_id}:${alias}`);
          const scopedTargets = override?.targets?.some((target: any) => Number(target.enabled) === 1) ? override.targets : targetsForReadiness;
          return {
            customerId: String(customer.customer_id),
            customerName: String(customer.customer_name),
            ...evaluateMediaReadiness({
              featureEnabled: Number(isVision ? customer.vision_enabled : customer.voice_enabled) === 1,
              aliasStatus: String(override?.status || aliasStatus),
              targets: scopedTargets,
            }),
          };
        }),
      }];
    }));
    return json({ models, media_readiness: mediaReadiness });
  }

  if (url.pathname.startsWith("/api/ops/models/") && request.method === "PATCH") {
    const alias = decodeURIComponent(url.pathname.slice("/api/ops/models/".length));
    const body = await readJson(request);
    const targetCustomerId = body.customerId ? requiredString(body.customerId, "customerId") : null;
    const globalRoute = await env.DB.prepare("SELECT * FROM model_routes WHERE alias=? LIMIT 1").bind(alias).first<any>();
    if (!globalRoute) return json({ error: "model_alias_not_found" }, 404);
    if (targetCustomerId) {
      const target = await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(targetCustomerId).first();
      if (!target) return json({ error: "customer_not_found" }, 404);
    }
    const override = targetCustomerId
      ? await env.DB.prepare("SELECT * FROM customer_model_routes WHERE customer_id=? AND alias=? LIMIT 1").bind(targetCustomerId, alias).first<any>()
      : null;
    const current = override ?? globalRoute;
    const now = unix();

    const provider = body.provider ?? current.provider;
    const providerModel = body.providerModel ?? current.provider_model;
    const providerConnectionId = body.providerConnectionId === undefined
      ? current.provider_connection_id
      : (body.providerConnectionId || null);
    const fallbackProvider = body.fallbackProvider ?? current.fallback_provider ?? null;
    const fallbackModel = body.fallbackModel ?? current.fallback_model ?? null;
    const fallbackProviderConnectionId = body.fallbackProviderConnectionId === undefined
      ? current.fallback_provider_connection_id
      : (body.fallbackProviderConnectionId || null);
    const nextStatus = body.status === undefined ? String(current.status || "active") : String(body.status);
    if (!["active", "paused", "disabled"].includes(nextStatus)) return json({ error: "invalid_model_route_status" }, 400);
    const byokPolicy = body.byokPolicy ?? current.byok_policy ?? "managed";
    if (!["managed","strict_byok","explicit_paid_fallback"].includes(String(byokPolicy))) {
      return json({ error: "invalid_byok_policy" }, 400);
    }

    if (!["workers-ai","mkety-managed"].includes(String(provider)) && !providerConnectionId) {
      return json({ error: "provider_connection_required" }, 400);
    }
    if (providerConnectionId) {
      const connection = await env.DB.prepare(
        "SELECT id,provider,status,validated_at,ownership,customer_id FROM provider_connections WHERE id=? LIMIT 1",
      ).bind(providerConnectionId).first<any>();
      if (!connection || connection.status !== "active" || !connection.validated_at || connection.provider !== provider) {
        return json({ error: "provider_connection_unvalidated_or_mismatch" }, 400);
      }
      if (connection.ownership === "customer" && (!targetCustomerId || connection.customer_id !== targetCustomerId)) {
        return json({ error: "customer_provider_requires_matching_tenant_route" }, 400);
      }
    }

    if (fallbackProvider && !["workers-ai","mkety-managed"].includes(String(fallbackProvider)) && !fallbackProviderConnectionId) {
      return json({ error: "fallback_provider_connection_required" }, 400);
    }
    if (fallbackProviderConnectionId) {
      const connection = await env.DB.prepare(
        "SELECT id,provider,status,validated_at,ownership,customer_id FROM provider_connections WHERE id=? LIMIT 1",
      ).bind(fallbackProviderConnectionId).first<any>();
      if (!connection || connection.status !== "active" || !connection.validated_at || connection.provider !== fallbackProvider) {
        return json({ error: "fallback_provider_connection_unvalidated_or_mismatch" }, 400);
      }
      if (connection.ownership === "customer" && (!targetCustomerId || connection.customer_id !== targetCustomerId)) {
        return json({ error: "customer_fallback_requires_matching_tenant_route" }, 400);
      }
    }

    if (Array.isArray(body.targets)) {
      const scopeKey = targetCustomerId ? `customer:${targetCustomerId}:${alias}` : `global:${alias}`;
      const sanitizedTargets: any[] = body.targets.slice(0, 10).map((target: any, index: number) => ({
        position: index,
        provider: requiredString(target.provider, "target.provider"),
        providerModel: requiredString(target.providerModel, "target.providerModel"),
        providerConnectionId: target.providerConnectionId ? String(target.providerConnectionId) : null,
        enabled: target.enabled === false ? 0 : 1,
        inputCreditsPerMillion: creditAtomsFromMkredits(target.inputCreditsPerMillion),
        outputCreditsPerMillion: creditAtomsFromMkredits(target.outputCreditsPerMillion),
        imageCredits: creditAtomsFromMkredits(target.imageCredits),
        audioCreditsPerMinute: creditAtomsFromMkredits(target.audioCreditsPerMinute),
        providerInputCostMicrosPerMillion: positiveInt(target.providerInputCostMicrosPerMillion, 0),
        providerOutputCostMicrosPerMillion: positiveInt(target.providerOutputCostMicrosPerMillion, 0),
        reasoningCapabilities: Array.isArray(target.reasoningCapabilities)
          ? [...new Set<string>((target.reasoningCapabilities as unknown[]).filter((mode: unknown): mode is string => mode === "standard" || mode === "high" || mode === "maximum"))]
          : [],
        reasoningCreditsPerMillion: target.reasoningCreditsPerMillion == null || target.reasoningCreditsPerMillion === ""
          ? null : creditAtomsFromMkredits(target.reasoningCreditsPerMillion),
        providerReasoningCostMicrosPerMillion: target.providerReasoningCostMicrosPerMillion == null || target.providerReasoningCostMicrosPerMillion === ""
          ? null : positiveInt(target.providerReasoningCostMicrosPerMillion, 0),
        providerImageCostMicros: positiveInt(target.providerImageCostMicros, 0),
        providerAudioCostMicrosPerMinute: positiveInt(target.providerAudioCostMicrosPerMinute, 0),
      }));
      if (!sanitizedTargets.length) return json({ error: "model_target_required" }, 400);
      for (const target of sanitizedTargets) {
        const normalizedTarget = deriveCustomerBaseRates(withKnownProviderCosts(target));
        Object.assign(target, alias === "mkety-media-vision"
          ? deriveCustomerMediaBaseRates(normalizedTarget, "vision")
          : alias === "mkety-media-speech"
            ? deriveCustomerMediaBaseRates(normalizedTarget, "speech")
            : normalizedTarget);
        const effectiveReasoningCapabilities = reasoningCapabilities(target.provider, target.providerModel, target.reasoningCapabilities);
        if (target.reasoningCapabilities.some((mode: string) => !effectiveReasoningCapabilities.includes(mode as any))) {
          return json({ error: "provider_model_reasoning_capability_unsupported", provider: target.provider, model: target.providerModel }, 400);
        }
        if (!["workers-ai","mkety-managed"].includes(target.provider)) {
          if (!target.providerConnectionId) return json({ error: "target_provider_connection_required" }, 400);
          const connection = await env.DB.prepare(
            "SELECT provider,status,validated_at,ownership,customer_id FROM provider_connections WHERE id=? LIMIT 1",
          ).bind(target.providerConnectionId).first<any>();
          if (!connection || connection.provider !== target.provider || connection.status !== "active" || !connection.validated_at) {
            return json({ error: "target_provider_connection_unvalidated_or_mismatch" }, 400);
          }
          target.validated = true;
          if (connection.ownership === "customer" && (!targetCustomerId || connection.customer_id !== targetCustomerId)) {
            return json({ error: "customer_target_requires_matching_tenant_route" }, 400);
          }
        }
        if (["workers-ai", "mkety-managed"].includes(target.provider)) target.validated = true;
      }
      if (nextStatus === "active" && !evaluateRouteReadiness("active", sanitizedTargets.map((target: any) => ({
        enabled: target.enabled,
        validated: target.validated,
        priced: routeTargetPricingConfigured({
          input_credits_per_million: target.inputCreditsPerMillion,
          output_credits_per_million: target.outputCreditsPerMillion,
          image_credits: target.imageCredits,
          provider_input_cost_micros_per_million: target.providerInputCostMicrosPerMillion,
          provider_output_cost_micros_per_million: target.providerOutputCostMicrosPerMillion,
          provider_image_cost_micros: target.providerImageCostMicros,
          audio_credits_per_minute: target.audioCreditsPerMinute,
        }, alias),
      }))).eligibleTargetCount) return json({ error: "active_route_requires_enabled_target" }, 400);
      const statements: D1PreparedStatement[] = [
        env.DB.prepare("DELETE FROM model_route_targets WHERE scope_key=?").bind(scopeKey),
      ];
      for (const target of sanitizedTargets) {
        statements.push(env.DB.prepare(
          `INSERT INTO model_route_targets
           (scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
           input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
           provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
            provider_image_cost_micros,provider_audio_cost_micros_per_minute,reasoning_capabilities_json,
            reasoning_credits_per_million,provider_reasoning_cost_micros_per_million,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          scopeKey,targetCustomerId,alias,target.position,target.provider,target.providerModel,target.providerConnectionId,target.enabled,
          target.inputCreditsPerMillion,target.outputCreditsPerMillion,target.imageCredits,target.audioCreditsPerMinute,
          target.providerInputCostMicrosPerMillion,target.providerOutputCostMicrosPerMillion,
          target.providerImageCostMicros,target.providerAudioCostMicrosPerMinute,
          JSON.stringify(target.reasoningCapabilities),target.reasoningCreditsPerMillion,target.providerReasoningCostMicrosPerMillion,now,now,
        ));
      }
      await env.DB.batch(statements);
    }

    if (nextStatus === "active" && !Array.isArray(body.targets)) {
      const scopeKey = targetCustomerId ? `customer:${targetCustomerId}:${alias}` : `global:${alias}`;
      const currentTargets = await env.DB.prepare(
        `SELECT t.*,pc.status AS provider_connection_status,pc.validated_at AS provider_connection_validated_at
         FROM model_route_targets t LEFT JOIN provider_connections pc ON pc.id=t.provider_connection_id
         WHERE t.scope_key=? ORDER BY t.position`,
      ).bind(scopeKey).all<any>();
      let readinessTargets = currentTargets.results ?? [];
      if (targetCustomerId && !readinessTargets.some((target: any) => Number(target.enabled) === 1)) {
        const globalTargets = await env.DB.prepare(
          `SELECT t.*,pc.status AS provider_connection_status,pc.validated_at AS provider_connection_validated_at
           FROM model_route_targets t LEFT JOIN provider_connections pc ON pc.id=t.provider_connection_id
           WHERE t.scope_key=? ORDER BY t.position`,
        ).bind(`global:${alias}`).all<any>();
        readinessTargets = globalTargets.results ?? [];
      }
      const eligibleCount = readinessTargets.filter((target: any) =>
        Number(target.enabled) === 1 && routeTargetValidated(target) && routeTargetPricingConfigured(target, alias),
      ).length;
      if (!eligibleCount) return json({ error: "active_route_requires_enabled_target" }, 400);
    }

    if (targetCustomerId) {
      await env.DB.prepare(
        `INSERT INTO customer_model_routes
         (customer_id,alias,provider,provider_model,provider_connection_id,fallback_provider,fallback_model,
          fallback_provider_connection_id,byok_policy,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(customer_id,alias) DO UPDATE SET
           provider=excluded.provider,provider_model=excluded.provider_model,
           provider_connection_id=excluded.provider_connection_id,
           fallback_provider=excluded.fallback_provider,fallback_model=excluded.fallback_model,
           fallback_provider_connection_id=excluded.fallback_provider_connection_id,
           byok_policy=excluded.byok_policy,status=excluded.status,updated_at=excluded.updated_at`,
      ).bind(
        targetCustomerId, alias, provider, providerModel, providerConnectionId,
        fallbackProvider, fallbackModel, fallbackProviderConnectionId,
        byokPolicy, nextStatus, now, now,
      ).run();
    } else {
      await env.DB.prepare(
        `UPDATE model_routes SET provider=?,provider_model=?,provider_connection_id=?,
         fallback_provider=?,fallback_model=?,fallback_provider_connection_id=?,
         byok_policy=?,status=COALESCE(?,status),updated_at=? WHERE alias=?`,
      ).bind(
        provider, providerModel, providerConnectionId,
        fallbackProvider, fallbackModel, fallbackProviderConnectionId,
        byokPolicy, body.status === undefined ? null : nextStatus, now, alias,
      ).run();
    }

    const runtimeLimitFields = [
      "requestsPerSecond","requestsPerMinute","tokensPerMinute","retryBaseSeconds","retryMaxSeconds",
    ];
    if (runtimeLimitFields.some((key) => body[key] !== undefined)) {
      const scopeKey = targetCustomerId ? `customer:${targetCustomerId}:${alias}` : `global:${alias}`;
      const existingLimit = await env.DB.prepare(
        "SELECT * FROM model_runtime_limits WHERE scope_key=? LIMIT 1",
      ).bind(scopeKey).first<any>();
      const optionalPositive = (value: unknown, current: unknown) => {
        if (value === undefined) return current == null ? null : Math.max(1, Math.floor(Number(current)));
        if (value === null || value === "" || Number(value) <= 0) return null;
        const n = Number(value);
        if (!Number.isFinite(n)) throw new HttpError(400, "invalid_model_runtime_limit");
        return Math.max(1, Math.floor(n));
      };
      const rps = optionalPositive(body.requestsPerSecond, existingLimit?.requests_per_second);
      const rpm = optionalPositive(body.requestsPerMinute, existingLimit?.requests_per_minute);
      const tpm = optionalPositive(body.tokensPerMinute, existingLimit?.tokens_per_minute);
      const retryBase = optionalPositive(body.retryBaseSeconds, existingLimit?.retry_base_seconds ?? 2) ?? 2;
      const retryMax = Math.max(retryBase, optionalPositive(body.retryMaxSeconds, existingLimit?.retry_max_seconds ?? 120) ?? 120);
      await env.DB.prepare(
        `INSERT INTO model_runtime_limits
         (scope_key,customer_id,alias,requests_per_second,requests_per_minute,tokens_per_minute,retry_base_seconds,retry_max_seconds,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(scope_key) DO UPDATE SET
           requests_per_second=excluded.requests_per_second,
           requests_per_minute=excluded.requests_per_minute,
           tokens_per_minute=excluded.tokens_per_minute,
           retry_base_seconds=excluded.retry_base_seconds,
           retry_max_seconds=excluded.retry_max_seconds,
           updated_at=excluded.updated_at`,
      ).bind(scopeKey,targetCustomerId,alias,rps,rpm,tpm,retryBase,retryMax,now).run();
    }

    const costFields = [
      "providerInputCostMicrosPerMillion","providerOutputCostMicrosPerMillion",
      "providerImageCostMicros","providerAudioCostMicrosPerMinute",
    ];
    const creditFields = ["inputCreditsPerMillion","outputCreditsPerMillion","imageCredits","audioCreditsPerMinute"];
    if (!targetCustomerId && (costFields.concat(creditFields).some((key) => body[key] !== undefined) || body.generateRate === true)) {
      const previous = await env.DB.prepare(
        "SELECT * FROM model_rates WHERE alias=? ORDER BY version DESC LIMIT 1",
      ).bind(alias).first<any>();
      const latest = await env.DB.prepare("SELECT COALESCE(MAX(version),0) AS v FROM model_rates WHERE alias=?")
        .bind(alias).first<any>();
      const known: Record<string, unknown> = withKnownProviderCosts({ provider, providerModel } as Record<string, unknown>);
      const inputCost = positiveInt(body.providerInputCostMicrosPerMillion, previous?.provider_input_cost_micros_per_million || Number(known.providerInputCostMicrosPerMillion || 0));
      const outputCost = positiveInt(body.providerOutputCostMicrosPerMillion, previous?.provider_output_cost_micros_per_million || Number(known.providerOutputCostMicrosPerMillion || 0));
      const imageCost = positiveInt(body.providerImageCostMicros, previous?.provider_image_cost_micros || 0);
      const audioCost = positiveInt(body.providerAudioCostMicrosPerMinute, previous?.provider_audio_cost_micros_per_minute || 0);
      const inputCredits = inputCost > 0 ? creditAtomsFromUsdMicros(inputCost) : (body.inputCreditsPerMillion === undefined ? Number(previous?.input_credits_per_million || 0) : creditAtomsFromMkredits(body.inputCreditsPerMillion));
      const outputCredits = outputCost > 0 ? creditAtomsFromUsdMicros(outputCost) : (body.outputCreditsPerMillion === undefined ? Number(previous?.output_credits_per_million || 0) : creditAtomsFromMkredits(body.outputCreditsPerMillion));
      const imageCredits = imageCost > 0 ? creditAtomsFromUsdMicros(imageCost) : (alias === "mkety-media-vision" ? 200_000 : (inputCost > 0 || outputCost > 0 ? 0 : Number(previous?.image_credits || 0)));
      const audioCredits = audioCost > 0 ? creditAtomsFromUsdMicros(audioCost) : (alias === "mkety-media-speech" ? 200_000 : (body.audioCreditsPerMinute === undefined ? Number(previous?.audio_credits_per_minute || 0) : creditAtomsFromMkredits(body.audioCreditsPerMinute)));

      await env.DB.prepare(
        `INSERT INTO model_rates
         (id,alias,version,input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
          provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,provider_image_cost_micros,
          provider_audio_cost_micros_per_minute,effective_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        id("rate"), alias, parseInt(String(latest?.v || 0), 10) + 1,
        inputCredits, outputCredits, imageCredits, audioCredits,
        inputCost, outputCost, imageCost, audioCost, now, now,
      ).run();
    }
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(id("aud"), "operator", "model.updated", "model_alias", alias, JSON.stringify({ alias, provider, customerId: targetCustomerId, byokPolicy }), now).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/ops/providers" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id,name,customer_id,provider,endpoint_url,default_model,extra_json,ownership,status,validated_at,validation_error,created_at,updated_at,1 AS has_key FROM provider_connections ORDER BY name",
    ).all();
    return json({ providers: rows.results ?? [] });
  }

  if (url.pathname === "/api/ops/providers" && request.method === "POST") {
    const body = await readJson(request);
    const provider = requiredString(body.provider, "provider");
    if (!["openai","anthropic","gemini","vertex","cloudflare-ai","bedrock","azure-openai","azure-foundry","openai-compatible"].includes(provider)) {
      return json({ error: "unsupported_provider" }, 400);
    }
    const structuredSecret = provider === "vertex" || provider === "bedrock";
    const apiKey = structuredSecret
      ? requiredString(body.credentialJson, "credentialJson")
      : requiredString(body.apiKey, "apiKey");
    if (structuredSecret) {
      try {
        const parsed = JSON.parse(apiKey);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "credential_json_must_be_object" }, 400);
      } catch {
        return json({ error: "invalid_credential_json" }, 400);
      }
    }
    const endpointUrl = body.endpointUrl ? String(body.endpointUrl).trim() : null;
    if (endpointUrl) {
      const parsed = new URL(endpointUrl);
      if (parsed.protocol !== "https:") return json({ error: "provider_endpoint_must_be_https" }, 400);
    }
    const ownership = body.ownership === "customer" ? "customer" : "mkety";
    const ownerCustomerId = ownership === "customer" ? requiredString(body.customerId, "customerId") : null;
    if (ownerCustomerId) {
      const owner = await env.DB.prepare("SELECT id FROM customers WHERE id=? LIMIT 1").bind(ownerCustomerId).first();
      if (!owner) return json({ error: "customer_not_found" }, 404);
    }
    const providerId = id("prv");
    const now = unix();
    await env.DB.prepare(
      "INSERT INTO provider_connections (id,name,customer_id,provider,endpoint_url,api_key_ciphertext,extra_json,ownership,status,created_at,updated_at,default_model) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      providerId,
      requiredString(body.name, "name"),
      ownerCustomerId,
      provider,
      endpointUrl,
      await protectStoredSecret(apiKey, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY),
      JSON.stringify(body.extra || {}),
      ownership,
      "disabled",
      now,
      now,
      body.model ? String(body.model).trim() : null,
    ).run();
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(id("aud"), "operator", "provider.created", "provider_connection", providerId, JSON.stringify({ provider }), now).run();
    return json({ id: providerId, provider, ownership, customerId: ownerCustomerId, status: "disabled", validationRequired: true }, 201);
  }

  if (url.pathname.startsWith("/api/ops/providers/") && url.pathname.endsWith("/test") && request.method === "POST") {
    const providerId = decodeURIComponent(url.pathname.slice("/api/ops/providers/".length, -"/test".length));
    const current = await env.DB.prepare("SELECT * FROM provider_connections WHERE id=? LIMIT 1").bind(providerId).first<any>();
    if (!current) return json({ error: "provider_not_found" }, 404);
    const apiKey = await revealStoredSecret(String(current.api_key_ciphertext), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
    const result = await validateProviderConnection({
      provider: String(current.provider),
      endpointUrl: current.endpoint_url ? String(current.endpoint_url) : null,
      apiKey,
      model: current.default_model ? String(current.default_model) : null,
      extra: current.extra_json ? JSON.parse(String(current.extra_json)) : {},
    });
    const now = unix();
    const credentialAccepted = Boolean(result.credentialAccepted ?? result.ok);
    const billingBlocked = Boolean(result.billingBlocked);
    const validated = result.ok || (credentialAccepted && billingBlocked);
    await env.DB.prepare(
      "UPDATE provider_connections SET status=?,validated_at=?,validation_error=?,updated_at=? WHERE id=?",
    ).bind(
      validated ? "active" : "disabled",
      validated ? now : null,
      result.ok ? null : (billingBlocked ? "provider_billing_blocked" : String(result.error || "provider_validation_failed")),
      now,
      providerId,
    ).run();
    return json({
      ok: result.ok,
      status: result.status,
      error: result.error ?? null,
      credentialAccepted,
      billingBlocked,
      returnedText: result.returnedText ?? null,
      providerId,
    }, validated ? 200 : 422);
  }

  if (url.pathname.startsWith("/api/ops/providers/") && request.method === "PATCH") {
    const providerId = decodeURIComponent(url.pathname.slice("/api/ops/providers/".length));
    const current = await env.DB.prepare("SELECT * FROM provider_connections WHERE id=? LIMIT 1").bind(providerId).first<any>();
    if (!current) return json({ error: "provider_not_found" }, 404);
    const body = await readJson(request);
    if (body.enabled === false && Object.keys(body).every((key) => key === "enabled")) {
      await env.DB.prepare(
        "UPDATE provider_connections SET status='disabled',validation_error='disabled_by_operator',updated_at=? WHERE id=?",
      ).bind(unix(),providerId).run();
      return json({ ok: true, status: "disabled" });
    }
    const endpointUrl = body.endpointUrl === undefined ? current.endpoint_url : (body.endpointUrl || null);
    if (endpointUrl) {
      const parsed = new URL(String(endpointUrl));
      if (parsed.protocol !== "https:") return json({ error: "provider_endpoint_must_be_https" }, 400);
    }
    const replacementSecret = body.credentialJson ?? body.apiKey;
    if (replacementSecret && ["vertex","bedrock"].includes(String(current.provider))) {
      try {
        const parsed = JSON.parse(String(replacementSecret));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "credential_json_must_be_object" }, 400);
      } catch {
        return json({ error: "invalid_credential_json" }, 400);
      }
    }
    const cipher = replacementSecret
      ? await protectStoredSecret(String(replacementSecret), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY)
      : current.api_key_ciphertext;
    await env.DB.prepare(
      "UPDATE provider_connections SET name=COALESCE(?,name),endpoint_url=?,api_key_ciphertext=?,default_model=COALESCE(?,default_model),extra_json=COALESCE(?,extra_json),status='disabled',validated_at=NULL,validation_error='revalidation_required',updated_at=? WHERE id=?",
    ).bind(
      body.name ?? null,
      endpointUrl,
      cipher,
      body.model === undefined ? null : (body.model ? String(body.model).trim() : null),
      body.extra === undefined ? null : JSON.stringify(body.extra),
      unix(),
      providerId,
    ).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/ops/health" && request.method === "GET") {
    const [customers, assistants, overdue, webhookErrors, openHandoffs] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM customers WHERE status='active'").first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM assistants WHERE status='active'").first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM reminders WHERE status='scheduled' AND due_at<?").bind(unix()).first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM webhook_events WHERE status='error' AND received_at>?").bind(unix()-86400).first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM human_handoffs WHERE status='open'").first<any>(),
    ]);
    return json({
      status: Number(overdue?.n || 0) || Number(webhookErrors?.n || 0) ? "attention" : "healthy",
      activeCustomers: Number(customers?.n || 0),
      activeAssistants: Number(assistants?.n || 0),
      overdueReminders: Number(overdue?.n || 0),
      webhookErrors24h: Number(webhookErrors?.n || 0),
      openHandoffs: Number(openHandoffs?.n || 0),
    });
  }

  if (url.pathname === "/api/ops/audit" && request.method === "GET") {
    const customerId = url.searchParams.get("customerId");
    const rows = customerId
      ? await env.DB.prepare("SELECT * FROM audit_events WHERE customer_id=? ORDER BY created_at DESC LIMIT 200").bind(customerId).all()
      : await env.DB.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 200").all();
    return json({ events: rows.results ?? [] });
  }

  if (url.pathname === "/api/ops/domains/status" && request.method === "GET") {
    const hostname = normalizeHostname(requiredString(url.searchParams.get("hostname"), "hostname"));
    const local = await env.DB.prepare(
      `SELECT d.provider_hostname_id,d.customer_id,d.status,d.verified_at,c.slug
       FROM customer_domains d JOIN customers c ON c.id=d.customer_id
       WHERE d.hostname=? AND d.kind='custom' LIMIT 1`,
    ).bind(hostname).first<any>();
    if (!local?.provider_hostname_id) return json({ error: "domain_not_found" }, 404);

    let providerStatus = "pending";
    let sslStatus: string | null = null;
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames/${local.provider_hostname_id}`,
        { headers: { authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}` } },
      );
      const data: any = await response.json();
      if (response.ok && data.success) {
        providerStatus = data.result.status === "active" ? "active" : "pending";
        sslStatus = data.result.ssl?.status ?? null;
      }
    } catch {
      providerStatus = "pending";
    }

    const evidence = await verifyDomainEvidence({
      hostname,
      expectedTarget: env.PORTAL_CNAME_TARGET,
      expectedOwner: String(local.slug),
      providerStatus,
    });
    const projected = projectDomainStatus(evidence);
    const stickyActive = Boolean(local.verified_at) || String(local.status) === "active";
    const finalStatus = stickyActive ? "active" : projected.status;
    await env.DB.prepare(
      `UPDATE customer_domains
       SET status=?,ssl_status=?,public_dns_ok=?,public_tls_ok=?,ownership_ok=?,public_checked_at=?,provider_status=?,
           verified_at=CASE WHEN ?='active' THEN COALESCE(verified_at,?) ELSE verified_at END
       WHERE hostname=? AND customer_id=?`,
    ).bind(
      finalStatus,
      sslStatus,
      evidence.dnsOk ? 1 : 0,
      evidence.tlsOk ? 1 : 0,
      evidence.ownershipOk ? 1 : 0,
      evidence.checkedAt,
      providerStatus,
      finalStatus,
      evidence.checkedAt,
      hostname,
      local.customer_id,
    ).run();

    const stored = await env.DB.prepare(
      "SELECT validation_json FROM customer_domains WHERE hostname=? AND kind='custom' LIMIT 1",
    ).bind(hostname).first<any>();
    return json({
      hostname,
      ...projected,
      status: finalStatus,
      publicVerified: finalStatus === "active",
      sslStatus,
      cnameTarget: env.PORTAL_CNAME_TARGET,
      routingOrigin: env.ROUTING_ORIGIN,
      workerRoute: `${hostname}/*`,
      validation: stored?.validation_json ? JSON.parse(stored.validation_json) : null,
    });
  }

  return json({ error: "not_found" }, 404);
}

async function handleAuth(request: Request, env: Env, customer: CustomerContext): Promise<Response> {
  const url = new URL(request.url);
  if (!["GET","HEAD","OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "invalid_origin" }, 403);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(requiredString(body.email, "email"));
    const password = requiredString(body.password, "password");
    const rateKey = "login:" + await sha256(customer.customerId + ":" + email);
    const rate = await env.DB.prepare(
      "SELECT attempts,window_started_at,blocked_until FROM auth_rate_limits WHERE scope_key=? LIMIT 1",
    ).bind(rateKey).first<any>();
    const loginNow = unix();
    if (Number(rate?.blocked_until || 0) > loginNow) {
      return json({ error: "too_many_attempts", retryAfter: Number(rate.blocked_until) - loginNow }, 429);
    }
    const row = await env.DB.prepare(
      `SELECT u.id,u.email,u.password_hash,u.password_salt,u.password_iterations,cu.role
       FROM users u JOIN customer_users cu ON cu.user_id=u.id
       WHERE cu.customer_id=? AND u.email=? AND u.status='active' LIMIT 1`,
    ).bind(customer.customerId, email).first<any>();
    if (!row?.password_hash || !row?.password_salt) {
      await recordAuthFailure(env.DB, rateKey, loginNow);
      return json({ error: "invalid_credentials" }, 401);
    }
    const accountControl = await effectiveAccountControl(env.DB, customer.customerId, String(row.id));
    if (accountControl.state !== "active") {
      return json({
        error: "account_" + accountControl.state,
        reason: accountControl.reason || null,
        expiresAt: accountControl.expiresAt,
      }, accountControl.state === "banned" ? 403 : 423);
    }
    const ok = await verifyPassword(password, row.password_salt, row.password_iterations, row.password_hash, env);
    if (!ok) {
      await recordAuthFailure(env.DB, rateKey, loginNow);
      return json({ error: "invalid_credentials" }, 401);
    }
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE scope_key=?").bind(rateKey).run();
    return issueSession(env, customer.customerId, row.id, row.role, row.email);
  }

  if (url.pathname === "/api/auth/setup/validate" && request.method === "GET") {
    const token = requiredString(url.searchParams.get("token"), "token");
    const tokenHash = await sha256(token);
    const now = unix();
    const row = await env.DB.prepare(
      `SELECT st.id,st.user_id,st.expires_at,u.email,cu.role
       FROM setup_tokens st
       JOIN users u ON u.id=st.user_id
       JOIN customer_users cu ON cu.user_id=u.id AND cu.customer_id=st.customer_id
       WHERE st.customer_id=? AND st.token_hash=? AND st.consumed_at IS NULL AND st.expires_at>? LIMIT 1`,
    ).bind(customer.customerId, tokenHash, now).first<any>();
    if (!row) return json({ valid: false, error: "invalid_or_expired_setup_token" }, 400);
    const setupControl = await effectiveAccountControl(env.DB, customer.customerId, String(row.user_id));
    if (setupControl.state !== "active") {
      return json({ valid: false, error: "account_" + setupControl.state, reason: setupControl.reason || null, expiresAt: setupControl.expiresAt }, setupControl.state === "banned" ? 403 : 423);
    }
    return json({
      valid: true,
      email: row.email,
      role: row.role,
      expiresAt: Number(row.expires_at),
      customerId: customer.customerId,
      customerName: customer.customerName,
    });
  }

  if (url.pathname === "/api/auth/setup" && request.method === "POST") {
    const body = await readJson(request);
    const token = requiredString(body.token, "token");
    const password = requiredString(body.password, "password");
    validatePassword(password);
    const tokenHash = await sha256(token);
    const now = unix();
    const row = await env.DB.prepare(
      `SELECT st.id,st.user_id,u.email,cu.role FROM setup_tokens st
       JOIN users u ON u.id=st.user_id
       JOIN customer_users cu ON cu.user_id=u.id AND cu.customer_id=st.customer_id
       WHERE st.customer_id=? AND st.token_hash=? AND st.consumed_at IS NULL AND st.expires_at>? LIMIT 1`,
    ).bind(customer.customerId, tokenHash, now).first<any>();
    if (!row) return json({ error: "invalid_or_expired_setup_token" }, 400);
    const setupControl = await effectiveAccountControl(env.DB, customer.customerId, String(row.user_id));
    if (setupControl.state !== "active") {
      return json({ error: "account_" + setupControl.state, reason: setupControl.reason || null, expiresAt: setupControl.expiresAt }, setupControl.state === "banned" ? 403 : 423);
    }
    let passwordData: Awaited<ReturnType<typeof hashPassword>>;
    try {
      passwordData = await hashPassword(password, env);
    } catch (error) {
      console.error("Assist customer password hashing failed", {
        customerId: customer.customerId,
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ error: "password_hash_failed_retryable" }, 500);
    }

    const claimed = await env.DB.prepare(
      "UPDATE setup_tokens SET consumed_at=? WHERE id=? AND customer_id=? AND consumed_at IS NULL AND expires_at>? RETURNING id",
    ).bind(now, row.id, customer.customerId, now).first<any>();
    if (!claimed) return json({ error: "invalid_or_expired_setup_token" }, 400);

    const sessionToken = randomToken(32);
    const sessionHash = await sha256(sessionToken);
    const sessionTtl = Number(env.SESSION_TTL_SECONDS || "2592000");
    const sessionId = id("ses");
    try {
      await env.DB.prepare(
        "UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,updated_at=? WHERE id=?",
      ).bind(passwordData.hash, passwordData.salt, passwordData.iterations, now, now, row.user_id).run();
      await env.DB.prepare(
        "INSERT INTO sessions (id,token_hash,user_id,customer_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(sessionId, sessionHash, row.user_id, customer.customerId, now + sessionTtl, now, now).run();
    } catch (error) {
      console.error("Assist customer setup commit failed", {
        customerId: customer.customerId,
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE setup_tokens SET consumed_at=NULL WHERE id=? AND customer_id=? AND consumed_at=? AND expires_at>?",
        ).bind(row.id, customer.customerId, now, unix()),
        env.DB.prepare(
          "UPDATE users SET password_hash=NULL,password_salt=NULL,password_iterations=NULL,password_changed_at=NULL,updated_at=? WHERE id=?",
        ).bind(unix(), row.user_id),
        env.DB.prepare("DELETE FROM sessions WHERE id=? AND customer_id=?").bind(sessionId, customer.customerId),
      ]).catch(() => undefined);
      return json({ error: "setup_commit_failed_retryable" }, 500);
    }
    return new Response(JSON.stringify({ ok: true, role: row.role, email: row.email }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": `${env.SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionTtl}`,
      },
    });
  }

  if (url.pathname === "/api/auth/password" && request.method === "POST") {
    const session = await requireSession(request, env, customer.customerId);
    if (!session) return json({ error: "unauthorized" }, 401);
    const body = await readJson(request);
    const currentPassword = requiredString(body.currentPassword, "currentPassword");
    const newPassword = requiredString(body.newPassword, "newPassword");
    validatePassword(newPassword);
    const row = await env.DB.prepare(
      "SELECT password_hash,password_salt,password_iterations FROM users WHERE id=? AND status='active' LIMIT 1",
    ).bind(session.userId).first<any>();
    if (!row?.password_hash || !row?.password_salt || !(await verifyPassword(currentPassword, row.password_salt, row.password_iterations, row.password_hash, env))) {
      return json({ error: "invalid_current_password" }, 400);
    }
    const next = await hashPassword(newPassword, env);
    const now = unix();
    await env.DB.prepare(
      "UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,updated_at=? WHERE id=?",
    ).bind(next.hash, next.salt, next.iterations, now, now, session.userId).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/sessions" && request.method === "GET") {
    const session = await requireSession(request, env, customer.customerId);
    if (!session) return json({ error: "unauthorized" }, 401);
    const rows = await env.DB.prepare(
      "SELECT id,created_at,last_seen_at,expires_at,user_agent,revoked_at FROM sessions WHERE user_id=? AND customer_id=? ORDER BY created_at DESC",
    ).bind(session.userId, customer.customerId).all();
    return json({ sessions: rows.results ?? [] });
  }

  if (url.pathname.startsWith("/api/auth/sessions/") && request.method === "DELETE") {
    const session = await requireSession(request, env, customer.customerId);
    if (!session) return json({ error: "unauthorized" }, 401);
    const sessionId = decodeURIComponent(url.pathname.slice("/api/auth/sessions/".length));
    const result = await env.DB.prepare(
      "UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND customer_id=? AND revoked_at IS NULL",
    ).bind(unix(), sessionId, session.userId, customer.customerId).run();
    return json({ ok: Boolean(result.meta.changes) });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = getSessionCookie(request, env);
    if (token) await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(unix(), await sha256(token)).run();
    return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(env) } });
  }

  if (url.pathname === "/api/auth/telegram/link/start" && request.method === "POST") {
    const session = await requireSession(request, env, customer.customerId);
    if (!session) return json({ error: "unauthorized" }, 401);

    // Prefer one of the customer's already-connected assistant bots so
    // recovery needs no separate technical setup. Fall back to the optional
    // central Mkety Assist auth bot when the customer has no bot yet.
    const channel = await env.DB.prepare(
      `SELECT ch.assistant_id,ch.config_json
       FROM assistant_channels ch
       WHERE ch.customer_id=? AND ch.channel='telegram' AND ch.status='active'
       ORDER BY ch.created_at ASC LIMIT 1`,
    ).bind(customer.customerId).first<any>();
    let recoveryAssistantId: string | null = null;
    let botUsername: string | null = null;
    if (channel?.config_json) {
      const cfg = JSON.parse(channel.config_json);
      if (cfg?.username) {
        recoveryAssistantId = String(channel.assistant_id);
        botUsername = String(cfg.username);
      }
    }
    if (!botUsername && env.MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME) {
      botUsername = env.MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME;
      recoveryAssistantId = null;
    }
    if (!botUsername) return json({ error: "connect_an_assistant_telegram_bot_first" }, 409);

    const token = randomToken(24);
    const now = unix();
    await env.DB.prepare(
      "INSERT INTO telegram_link_challenges (id,customer_id,user_id,token_hash,assistant_id,expires_at,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(id("tlc"), customer.customerId, session.userId, await sha256(token), recoveryAssistantId, now + 600, now).run();
    return json({
      ok: true,
      url: `https://t.me/${botUsername}?start=link_${token}`,
      viaAssistant: Boolean(recoveryAssistantId),
      expiresInSeconds: 600,
    });
  }

  if (url.pathname === "/api/auth/recovery/start" && request.method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(requiredString(body.email, "email"));
    const user = await env.DB.prepare(
      `SELECT u.id,u.telegram_user_id,u.telegram_recovery_assistant_id FROM users u
       JOIN customer_users cu ON cu.user_id=u.id
       WHERE cu.customer_id=? AND u.email=? AND u.status='active' LIMIT 1`,
    ).bind(customer.customerId, email).first<any>();

    // Always return the same public response to avoid account enumeration.
    if (user?.telegram_user_id) {
      const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const now = unix();
      const challengeId = id("rec");
      const codeHash = await sha256(code);
      await env.DB.prepare(
        "INSERT INTO recovery_challenges (id,customer_id,user_id,channel,code_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(challengeId, customer.customerId, user.id, "telegram", codeHash, now + Number(env.RECOVERY_TTL_SECONDS), now).run();
      let recoveryBotToken = env.MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN || "";
      if (user.telegram_recovery_assistant_id) {
        const secret = await env.DB.prepare(
          "SELECT ciphertext FROM assistant_secrets WHERE assistant_id=? AND name='telegram_bot_token' LIMIT 1",
        ).bind(user.telegram_recovery_assistant_id).first<any>();
        if (secret?.ciphertext) recoveryBotToken = await revealStoredSecret(secret.ciphertext, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
      }
      const sent = await sendTelegramRecoveryCode(recoveryBotToken, user.telegram_user_id, customer.customerName, code);
      if (!sent) {
        console.error("telegram recovery delivery failed", { challengeId, customerId: customer.customerId, userId: user.id });
      }
    }
    return json({ ok: true, message: "If a linked recovery method exists, a recovery code has been sent." });
  }

  if (url.pathname === "/api/auth/recovery/verify" && request.method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(requiredString(body.email, "email"));
    const code = requiredString(body.code, "code");
    const newPassword = requiredString(body.newPassword, "newPassword");
    validatePassword(newPassword);
    const now = unix();
    const user = await env.DB.prepare(
      `SELECT u.id,u.email,cu.role FROM users u JOIN customer_users cu ON cu.user_id=u.id
       WHERE cu.customer_id=? AND u.email=? AND u.status='active' LIMIT 1`,
    ).bind(customer.customerId, email).first<any>();
    if (!user) return json({ error: "invalid_or_expired_code" }, 400);
    const challenge = await env.DB.prepare(
      `SELECT id,code_hash,attempts FROM recovery_challenges
       WHERE customer_id=? AND user_id=? AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1`,
    ).bind(customer.customerId, user.id, now).first<any>();
    if (!challenge || challenge.attempts >= 5 || challenge.code_hash !== await sha256(code)) {
      if (challenge) await env.DB.prepare("UPDATE recovery_challenges SET attempts=attempts+1 WHERE id=?").bind(challenge.id).run();
      return json({ error: "invalid_or_expired_code" }, 400);
    }
    const p = await hashPassword(newPassword, env);
    await env.DB.batch([
      env.DB.prepare("UPDATE recovery_challenges SET consumed_at=? WHERE id=?").bind(now, challenge.id),
      env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE id=?")
        .bind(p.hash, p.salt, p.iterations, now, user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND customer_id=?").bind(user.id, customer.customerId),
    ]);
    return issueSession(env, customer.customerId, user.id, user.role, user.email);
  }

  return json({ error: "not_found" }, 404);
}

async function handleTelegramAuthBotWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!env.MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET || !constantTimeEqual(secret, env.MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET)) {
    return json({ error: "not_found" }, 404);
  }
  const update = await readJson(request);
  const message = update.message;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const telegramUserId = message?.from?.id ? String(message.from.id) : "";
  const username = message?.from?.username ? String(message.from.username) : null;
  if (!telegramUserId || !text.startsWith("/start link_")) return json({ ok: true });

  const token = text.slice("/start link_".length).split(/\s+/)[0];
  const now = unix();
  const challenge = await env.DB.prepare(
    `SELECT id,user_id FROM telegram_link_challenges
     WHERE token_hash=? AND assistant_id IS NULL AND consumed_at IS NULL AND expires_at>? LIMIT 1`,
  ).bind(await sha256(token), now).first<any>();
  if (!challenge) {
    await sendTelegramText(env, telegramUserId, "This Mkety Assist link has expired. Return to your portal and start Telegram linking again.");
    return json({ ok: true });
  }
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET telegram_user_id=?,telegram_username=?,telegram_recovery_assistant_id=NULL,telegram_linked_at=?,updated_at=? WHERE id=?")
        .bind(telegramUserId, username, now, now, challenge.user_id),
      env.DB.prepare("UPDATE telegram_link_challenges SET consumed_at=? WHERE id=?").bind(now, challenge.id),
    ]);
    await sendTelegramText(env, telegramUserId, "Telegram is now connected to your Mkety Assist account for secure access recovery.");
  } catch {
    await sendTelegramText(env, telegramUserId, "This Telegram account is already linked to another Mkety Assist user. Contact Mkety support if this is unexpected.");
  }
  return json({ ok: true });
}

async function handleCustomerApi(request: Request, env: Env, customer: CustomerContext, session: Session): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/me" && request.method === "GET") {
    const user = await env.DB.prepare(
      "SELECT email,display_name,telegram_user_id,telegram_username FROM users WHERE id=?",
    ).bind(session.userId).first();
    const features = await env.DB.prepare("SELECT * FROM feature_policy WHERE customer_id=?").bind(customer.customerId).first();
    const account = await env.DB.prepare("SELECT status,billing_status,grace_until FROM customers WHERE id=? LIMIT 1").bind(customer.customerId).first<any>();
    const userControl = await effectiveAccountControl(env.DB, customer.customerId, session.userId);
    return json({
      customer,
      session,
      user,
      features,
      accountStatus: String(account?.status || "active"),
      billingStatus: String(account?.billing_status || "pending"),
      graceUntil: account?.grace_until == null ? null : Number(account.grace_until),
      userControl,
    });
  }

  if (url.pathname === "/api/domains" && request.method === "GET") {
    const currentHost = url.hostname.toLowerCase();
    const currentDomain = await env.DB.prepare(
      "SELECT hostname,kind,status,verified_at FROM customer_domains WHERE customer_id=? AND hostname=? LIMIT 1",
    ).bind(customer.customerId,currentHost).first<any>();
    if (currentDomain?.kind === "custom") {
      const now = unix();
      await env.DB.prepare(
        `UPDATE customer_domains
         SET status='active',verified_at=COALESCE(verified_at,?),public_dns_ok=1,public_tls_ok=1,ownership_ok=1,public_checked_at=?
         WHERE customer_id=? AND hostname=?`,
      ).bind(now,now,customer.customerId,currentHost).run();
    }
    const rows = await env.DB.prepare(
      "SELECT hostname,kind,is_primary,status,ssl_status,validation_json,verified_at,public_dns_ok,public_tls_ok,ownership_ok,public_checked_at,provider_status FROM customer_domains WHERE customer_id=? ORDER BY is_primary DESC,created_at ASC",
    ).bind(customer.customerId).all<any>();
    return json({
      domains: (rows.results ?? []).map((row: any) => ({
        hostname: row.hostname,
        kind: row.kind,
        isPrimary: Boolean(row.is_primary),
        status: row.status,
        sslStatus: row.ssl_status,
        validation: row.validation_json ? JSON.parse(row.validation_json) : null,
        verifiedAt: row.verified_at,
        publicDnsOk: Boolean(row.public_dns_ok),
        publicTlsOk: Boolean(row.public_tls_ok),
        ownershipOk: Boolean(row.ownership_ok),
        publicCheckedAt: row.public_checked_at,
        providerStatus: row.provider_status,
        providerPending: row.status === "active" && row.provider_status === "pending",
      })),
      cnameTarget: env.PORTAL_CNAME_TARGET,
    });
  }

  if (url.pathname === "/api/domains" && request.method === "POST") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const body = await readJson(request);
    const hostname = normalizeHostname(requiredString(body.hostname, "hostname"));
    const existing = await env.DB.prepare(
      "SELECT customer_id,kind FROM customer_domains WHERE hostname=? LIMIT 1",
    ).bind(hostname).first<any>();
    if (existing && existing.customer_id !== customer.customerId) return json({ error: "domain_already_in_use" }, 409);
    if (existing?.kind === "hosted") return json({ error: "hosted_domain_cannot_be_reused" }, 409);
    try {
      return json(await createCustomHostname(env, customer.customerId, hostname), existing ? 200 : 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Customer custom-domain provisioning failed", { customerId: customer.customerId, hostname, error: message });
      return json({ error: "custom_domain_provisioning_failed", details: message.slice(0, 500), cnameTarget: env.PORTAL_CNAME_TARGET }, 502);
    }
  }

  if (url.pathname === "/api/domains/verify" && request.method === "POST") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const body = await readJson(request);
    const hostname = normalizeHostname(requiredString(body.hostname, "hostname"));
    const domain = await env.DB.prepare(
      "SELECT hostname,kind,status,verified_at,provider_status FROM customer_domains WHERE hostname=? AND customer_id=? LIMIT 1",
    ).bind(hostname, customer.customerId).first<any>();
    if (!domain) return json({ error: "domain_not_found" }, 404);
    if (domain.kind !== "custom") return json({ error: "custom_domain_required" }, 400);
    const evidence = await verifyDomainEvidence({
      hostname,
      expectedTarget: env.PORTAL_CNAME_TARGET,
      expectedOwner: customer.customerSlug,
      providerStatus: String(domain.provider_status || "pending"),
    });
    const projected = projectDomainStatus(evidence);
    const stickyActive = Boolean(domain.verified_at) || String(domain.status) === "active";
    const finalStatus = stickyActive ? "active" : projected.status;
    await env.DB.prepare(
      `UPDATE customer_domains SET status=?,public_dns_ok=?,public_tls_ok=?,ownership_ok=?,public_checked_at=?,
       verified_at=CASE WHEN ?='active' THEN COALESCE(verified_at,?) ELSE verified_at END
       WHERE hostname=? AND customer_id=?`,
    ).bind(
      finalStatus,evidence.dnsOk?1:0,evidence.tlsOk?1:0,evidence.ownershipOk?1:0,evidence.checkedAt,
      finalStatus,evidence.checkedAt,hostname,customer.customerId,
    ).run();
    return json({ hostname, ...projected, status: finalStatus, publicVerified: finalStatus === "active" });
  }

  if (url.pathname === "/api/settings" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT id,name,slug,logo_url,brand_color,status FROM customers WHERE id=?")
      .bind(customer.customerId).first();
    return json({ customer: row });
  }

  if (url.pathname === "/api/settings" && request.method === "PATCH") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const body = await readJson(request);
    const color = body.brandColor === null || body.brandColor === "" ? null : String(body.brandColor || "").trim();
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return json({ error: "invalid_brand_color" }, 400);
    const logoUrl = body.logoUrl === null || body.logoUrl === "" ? null : String(body.logoUrl || "").trim();
    if (logoUrl) {
      const parsed = new URL(logoUrl);
      if (parsed.protocol !== "https:") return json({ error: "logo_url_must_be_https" }, 400);
    }
    await env.DB.prepare(
      "UPDATE customers SET logo_url=?,brand_color=?,updated_at=? WHERE id=?",
    ).bind(logoUrl, color, unix(), customer.customerId).run();
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(id("aud"), "customer_user", session.userId, customer.customerId, "branding.updated", "customer", customer.customerId, unix()).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/team" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT u.id,u.email,u.display_name,u.telegram_username,u.status,cu.role,cu.created_at
       FROM customer_users cu JOIN users u ON u.id=cu.user_id
       WHERE cu.customer_id=? ORDER BY cu.created_at ASC`,
    ).bind(customer.customerId).all();
    return json({ members: rows.results ?? [] });
  }

  if (url.pathname === "/api/team" && request.method === "POST") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const body = await readJson(request);
    const email = normalizeEmail(requiredString(body.email, "email"));
    const role = String(body.role || "member");
    if (!["admin","member"].includes(role) && !(session.role === "owner" && role === "owner")) {
      return json({ error: "invalid_role" }, 400);
    }
    const now = unix();
    let user = await env.DB.prepare("SELECT id,password_hash FROM users WHERE email=? LIMIT 1").bind(email).first<any>();
    let created = false;
    if (!user) {
      user = { id: id("usr"), password_hash: null };
      await env.DB.prepare("INSERT INTO users (id,email,status,created_at,updated_at) VALUES (?,?,?,?,?)")
        .bind(user.id, email, "active", now, now).run();
      created = true;
    }
    await env.DB.prepare(
      "INSERT INTO customer_users (customer_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(customer_id,user_id) DO UPDATE SET role=excluded.role",
    ).bind(customer.customerId, user.id, role, now).run();

    let setupUrl: string | null = null;
    if (!user.password_hash) {
      const token = randomToken(32);
      await env.DB.prepare(
        "INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)",
      ).bind(id("set"), customer.customerId, user.id, await sha256(token), now + 86400, now).run();
      setupUrl = `https://${customer.hostname}/setup?token=${encodeURIComponent(token)}`;
    }
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(id("aud"), "customer_user", session.userId, customer.customerId, created ? "team.invited" : "team.added", "user", user.id, JSON.stringify({ email, role }), now).run();
    return json({ ok: true, userId: user.id, setupUrl }, 201);
  }

  if (url.pathname.startsWith("/api/team/") && request.method === "PATCH") {
    if (session.role !== "owner") return json({ error: "owner_required" }, 403);
    const userId = decodeURIComponent(url.pathname.slice("/api/team/".length));
    if (userId === session.userId) return json({ error: "cannot_change_own_membership_here" }, 400);
    const body = await readJson(request);
    if (body.remove === true) {
      await env.DB.prepare("DELETE FROM customer_users WHERE customer_id=? AND user_id=?").bind(customer.customerId, userId).run();
      await env.DB.prepare("DELETE FROM sessions WHERE customer_id=? AND user_id=?").bind(customer.customerId, userId).run();
      return json({ ok: true });
    }
    const role = String(body.role || "");
    if (!["owner","admin","member"].includes(role)) return json({ error: "invalid_role" }, 400);
    await env.DB.prepare("UPDATE customer_users SET role=? WHERE customer_id=? AND user_id=?")
      .bind(role, customer.customerId, userId).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/assistants" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id,name,slug,status,model_alias,timezone,memory_enabled,monthly_credit_cap,automation_paused,archived_at,current_version FROM assistants WHERE customer_id=? AND deleted_at IS NULL ORDER BY created_at DESC",
    ).bind(customer.customerId).all<any>();
    return json({ assistants: (rows.results ?? []).map((row: any) => ({
      ...row,
      monthly_credit_cap: row.monthly_credit_cap == null ? null : mkreditsFromCreditAtoms(row.monthly_credit_cap),
    })) });
  }

  if (url.pathname === "/api/assistants" && request.method === "POST") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const policy = await env.DB.prepare("SELECT max_assistants FROM feature_policy WHERE customer_id=?")
      .bind(customer.customerId).first<any>();
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM assistants WHERE customer_id=? AND deleted_at IS NULL")
      .bind(customer.customerId).first<any>();
    if ((count?.n ?? 0) >= (policy?.max_assistants ?? 5)) return json({ error: "assistant_limit_reached" }, 409);
    const body = await readJson(request);
    const now = unix();
    const assistantId = id("ast");
    const name = requiredString(body.name, "name");
    const slug = normalizeSlug(body.slug ? String(body.slug) : name);
    const modelAlias = body.modelAlias ? String(body.modelAlias) : "mkety-smart";
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO assistants (id,customer_id,name,slug,status,model_alias,timezone,memory_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).bind(assistantId, customer.customerId, name, slug, "active", modelAlias, body.timezone || "UTC", body.memoryEnabled === false ? 0 : 1, now, now),
      env.DB.prepare(
        "INSERT INTO assistant_prompt_versions (id,customer_id,assistant_id,version,instructions,status,created_at,published_at) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(id("prm"), customer.customerId, assistantId, 1, String(body.instructions || ""), "published", now, now),
      env.DB.prepare(
        "INSERT INTO assistant_config_versions (id,customer_id,assistant_id,version,config_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(
        id("asv"), customer.customerId, assistantId, 1,
        JSON.stringify({ name, status: "active", modelAlias, timezone: body.timezone || "UTC", memoryEnabled: body.memoryEnabled !== false, monthlyCreditCap: null, automationPaused: false }),
        session.userId, now,
      ),
      env.DB.prepare("INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id("aud"), "customer_user", session.userId, customer.customerId, "assistant.created", "assistant", assistantId, now),
    ]);
    return json({ id: assistantId, name, slug, modelAlias }, 201);
  }

  if (url.pathname === "/api/usage" && request.method === "GET") {
    const account = await env.DB.prepare(
      "SELECT balance,lifetime_consumed FROM credit_accounts WHERE customer_id=?",
    ).bind(customer.customerId).first<any>();
    const policy = await env.DB.prepare(
      "SELECT subscription_amount_minor,setup_fee_minor FROM commercial_policy WHERE customer_id=?",
    ).bind(customer.customerId).first<any>();
    return json(customerUsageProjection({
      monthlyFeeMinor: Math.max(0, Number(policy?.subscription_amount_minor || 0)),
      setupFeeMinor: Math.max(0, Number(policy?.setup_fee_minor || 0)),
      creditsAvailable: mkreditsFromCreditAtoms(Math.max(0, Number(account?.balance || 0))),
      creditsUsed: mkreditsFromCreditAtoms(Math.max(0, Number(account?.lifetime_consumed || 0))),
    }));
  }

  if (url.pathname === "/api/billing/credit-offer" && request.method === "GET") {
    const policy = await env.DB.prepare(
      "SELECT subscription_amount_minor,included_credits,funding_mode,minimum_funding_minor,setup_fee_minor,topup_enabled,currency FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    if (!policy) return json({ error: "commercial_policy_unavailable" }, 404);
    const recurringAmountMinor = Math.max(0, Number(policy.subscription_amount_minor || 0));
    const includedCredits = Math.max(0, Number(policy.included_credits || 0));
    const minimumFundingMinor = Math.max(0, Number(policy.minimum_funding_minor || recurringAmountMinor));
    const minimumFundingCredits = recurringAmountMinor > 0
      ? Math.max(1, Math.floor(includedCredits * minimumFundingMinor / recurringAmountMinor))
      : includedCredits;
    return json({
      currency: String(policy.currency || "USD"),
      recurringAmountMinor,
      recurringCredits: mkreditsFromCreditAtoms(includedCredits),
      setupFeeMinor: Math.max(0, Number(policy.setup_fee_minor || 0)),
      fundingMode: String(policy.funding_mode || "full_period"),
      minimumFundingMinor,
      minimumFundingCredits: mkreditsFromCreditAtoms(minimumFundingCredits),
      topupEnabled: Boolean(policy.topup_enabled),
    });
  }

  if (url.pathname === "/api/billing/funding-quote" && request.method === "POST") {
    const body = await readJson(request);
    const policy = await env.DB.prepare(
      "SELECT subscription_amount_minor,included_credits,funding_mode,minimum_funding_minor,setup_fee_minor FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    if (!policy) return json({ error: "commercial_policy_unavailable" }, 404);
    const recurringBase = Math.max(1, Number(policy.subscription_amount_minor || 0));
    const setupFeeMinor = Math.max(0, Number(policy.setup_fee_minor || 0));
    const minimumFundingMinor = Math.max(1, Number(policy.minimum_funding_minor || recurringBase));
    let recurringPaid = recurringBase;
    if (String(policy.funding_mode) === "prepaid_partial") {
      recurringPaid = body.fundingAmountUsd == null || String(body.fundingAmountUsd).trim() === ""
        ? recurringBase
        : parsePaymentAmountMinor(body.fundingAmountUsd);
      if (recurringPaid < minimumFundingMinor || recurringPaid > recurringBase) {
        return json({ error: "invalid_funding_amount", minimumFundingMinor, maximumFundingMinor: recurringBase }, 400);
      }
    }
    const credits = String(policy.funding_mode) === "prepaid_partial"
      ? Math.max(1, Math.floor(Number(policy.included_credits || 0) * recurringPaid / recurringBase))
      : Math.max(0, Number(policy.included_credits || 0));
    return json({
      recurringAmountMinor: recurringPaid,
      setupFeeMinor,
      totalAmountMinor: recurringPaid + setupFeeMinor,
      credits: mkreditsFromCreditAtoms(credits),
      minimumFundingMinor,
      maximumFundingMinor: recurringBase,
      fundingMode: String(policy.funding_mode || "full_period"),
    });
  }

  if (url.pathname === "/api/billing/credit-quote" && request.method === "POST") {
    const body = await readJson(request);
    const amountMinor = parsePaymentAmountMinor(body.amountUsd);
    if (amountMinor < 100 || amountMinor > 10_000_000) return json({ error: "invalid_credit_amount" }, 400);
    const creditAtoms = Math.max(1, creditAtomsFromUsdMinor(amountMinor));
    return json({ amountMinor, currency: "USD", credits: mkreditsFromCreditAtoms(creditAtoms) });
  }

  if (url.pathname === "/api/billing/methods" && request.method === "GET") {
    const koraRow = await env.DB.prepare(
      "SELECT enabled,healthy FROM payment_method_health WHERE method='kora' LIMIT 1",
    ).first<any>();
    const status = {
      nowpayments: Boolean(env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET),
      flutterwave: Boolean(env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET),
      kora: Boolean(koraRow?.enabled) && Boolean(koraRow?.healthy),
    };
    const methods = listPaymentMethods(status);
    return json({ methods, defaultMethod: defaultPaymentMethod(status), source: "direct_config" });
  }

  if (url.pathname === "/api/billing/checkouts" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id,reference,provider,credits,canonical_amount_minor,canonical_currency,
              provider_amount_minor,provider_currency,status,created_at,settled_at,purchase_type
       FROM payment_checkouts WHERE customer_id=? ORDER BY created_at DESC LIMIT 50`,
    ).bind(customer.customerId).all();
    return json({ checkouts: (rows.results ?? []).map((row: any) => ({ ...row, credits: mkreditsFromCreditAtoms(row.credits) })) });
  }

  if (url.pathname === "/api/billing/plan/start" && request.method === "POST") {
    if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "payment_provider_not_configured" }, 503);
    const policy = await env.DB.prepare(
      "SELECT subscription_amount_minor,included_credits,funding_mode,minimum_funding_minor,setup_fee_minor,currency FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    if (!policy) return json({ error: "commercial_policy_unavailable" }, 404);
    const customerRow = await env.DB.prepare("SELECT billing_status FROM customers WHERE id=? LIMIT 1")
      .bind(customer.customerId).first<any>();
    if (customerRow?.billing_status === "current") return json({ error: "plan_already_current" }, 409);

    const body = await readJson(request);
    const recurringBase = Math.max(1, Number(policy.subscription_amount_minor || 0));
    const setupFeeMinor = Math.max(0, Number(policy.setup_fee_minor || 0));
    let recurringPaid = recurringBase;
    if (String(policy.funding_mode) === "prepaid_partial") {
      const requested = body.fundingAmountUsd == null
        ? Number(policy.minimum_funding_minor || recurringBase)
        : parsePaymentAmountMinor(body.fundingAmountUsd);
      const min = Math.max(1, Number(policy.minimum_funding_minor || 0));
      if (requested < min || requested > recurringBase) return json({ error: "invalid_funding_amount" }, 400);
      recurringPaid = requested;
    }
    const canonicalAmountMinor = recurringPaid + setupFeeMinor;
    const credits = String(policy.funding_mode) === "prepaid_partial"
      ? Math.max(1, Math.floor(Number(policy.included_credits || 0) * recurringPaid / recurringBase))
      : Math.max(0, Number(policy.included_credits || 0));

    const paymentMethod = await resolveRequestedPaymentMethod(env, body.paymentMethod);
    if (!paymentMethod) return json({ error: "payment_method_unavailable" }, 503);
    if (paymentMethod === "nowpayments") {
      return startAssistNowPaymentsCheckout({ env, customer, session, credits, canonicalAmountMinor, purchaseType: "plan" });
    }
    if (paymentMethod === "flutterwave") {
      return startAssistFlutterwaveCheckout({
        env, customer, session, credits, canonicalAmountMinor,
        paymentCurrency: String(body.paymentCurrency || "USD").toUpperCase(),
        purchaseType: "plan",
      });
    }
    if (paymentMethod === "kora") {
      return startAssistKoraCheckout({ env, customer, session, credits, canonicalAmountMinor, purchaseType: "plan" });
    }
    return json({ error: "payment_method_unavailable" }, 503);
  }

  if (url.pathname === "/api/billing/topup/start" && request.method === "POST") {
    if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "topup_provider_not_configured" }, 503);
    const policy = await env.DB.prepare(
      "SELECT topup_enabled,currency FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    if (!policy?.topup_enabled) return json({ error: "topups_not_enabled" }, 403);
    const body = await readJson(request);
    let credits: number;
    let canonicalAmountMinor: number;
    if (body.amountUsd !== undefined && body.amountUsd !== null && String(body.amountUsd).trim() !== "") {
      canonicalAmountMinor = parsePaymentAmountMinor(body.amountUsd);
      if (canonicalAmountMinor < 100 || canonicalAmountMinor > 10_000_000) return json({ error: "invalid_topup_amount" }, 400);
      credits = Math.max(1, creditAtomsFromUsdMinor(canonicalAmountMinor));
    } else {
      const requestedMkredits = Number(body.credits || 0);
      if (!Number.isFinite(requestedMkredits) || requestedMkredits < 100 || requestedMkredits > 5_000_000) return json({ error: "invalid_topup_credits" }, 400);
      credits = creditAtomsFromMkredits(requestedMkredits);
      canonicalAmountMinor = Math.max(1, usdMinorFromCreditAtoms(credits));
    }
    const paymentMethod = await resolveRequestedPaymentMethod(env, body.paymentMethod);
    if (!paymentMethod) return json({ error: "payment_method_unavailable" }, 503);
    if (paymentMethod === "nowpayments") {
      return startAssistNowPaymentsCheckout({ env, customer, session, credits, canonicalAmountMinor, purchaseType: "topup" });
    }
    if (paymentMethod === "flutterwave") {
      return startAssistFlutterwaveCheckout({
        env, customer, session, credits, canonicalAmountMinor,
        paymentCurrency: String(body.paymentCurrency || "USD").toUpperCase(),
        purchaseType: "topup",
      });
    }
    if (paymentMethod === "kora") {
      return startAssistKoraCheckout({ env, customer, session, credits, canonicalAmountMinor, purchaseType: "topup" });
    }
    return json({ error: "payment_method_unavailable" }, 503);
  }

  const runtimeResponse = await handleRuntimeApi(request, env, customer, session);
  if (runtimeResponse) return runtimeResponse;

  return json({ error: "not_found" }, 404);
}

async function resolveRequestedPaymentMethod(env: Env, requested: unknown) {
  const koraRow = await env.DB.prepare(
    "SELECT enabled,healthy FROM payment_method_health WHERE method='kora' LIMIT 1",
  ).first<any>();
  const health = {
    nowpayments: Boolean(env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET),
    flutterwave: Boolean(env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET),
    kora: Boolean(koraRow?.enabled) && Boolean(koraRow?.healthy),
  };
  const available = listPaymentMethods(health);
  const selected = String(requested || "").toLowerCase();
  return selected ? (available.includes(selected as any) ? selected : null) : (available[0] ?? null);
}

async function startAssistNowPaymentsCheckout(input: {
  env: Env;
  customer: CustomerContext;
  session: Session;
  credits: number;
  canonicalAmountMinor: number;
  purchaseType: "plan" | "topup";
}) {
  const { env, customer, session, credits, canonicalAmountMinor, purchaseType } = input;
  const apiKey = String(env.NOWPAYMENTS_API_KEY || "");
  const ipnSecret = String(env.NOWPAYMENTS_IPN_SECRET || "");
  if (!apiKey || !ipnSecret) return json({ error: "payment_provider_not_configured" }, 503);

  const checkoutId = id("chk");
  const reference = `ASSIST-MKA-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = unix();
  await env.DB.prepare(
    `INSERT INTO payment_checkouts
     (id,customer_id,user_id,reference,provider,credits,canonical_amount_minor,canonical_currency,status,created_at,purchase_type)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(checkoutId, customer.customerId, session.userId, reference, "nowpayments", credits, canonicalAmountMinor, "USD", "pending", now, purchaseType).run();

  const response = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      price_amount: canonicalAmountMinor / 100,
      price_currency: "usd",
      order_id: reference,
      order_description: `Mkety Assist ${reference}`,
      ipn_callback_url: `https://${env.PORTAL_CNAME_TARGET}/api/payment/nowpayments/webhook`,
      success_url: `https://${env.PORTAL_CNAME_TARGET}/payment/return?reference=${encodeURIComponent(reference)}`,
      cancel_url: `https://${env.PORTAL_CNAME_TARGET}/payment/return?reference=${encodeURIComponent(reference)}`,
    }),
  });
  const payload = await response.json<any>().catch(() => null);
  const providerInvoiceId = String(payload?.id || payload?.invoice_id || "").trim();
  const hostedUrl = String(payload?.invoice_url || "");
  if (!response.ok || !providerInvoiceId || !hostedUrl.startsWith("https://")) {
    await env.DB.prepare("UPDATE payment_checkouts SET status='failed' WHERE id=? AND status='pending'").bind(checkoutId).run();
    return json({ error: "nowpayments_checkout_failed", message: "NOWPayments checkout could not be prepared." }, 502);
  }

  await env.DB.prepare(
    "UPDATE payment_checkouts SET provider_payment_id=?,provider_amount_minor=?,provider_currency=? WHERE id=? AND status='pending'",
  ).bind(providerInvoiceId, canonicalAmountMinor, "USD", checkoutId).run();

  return json({
    ok: true,
    provider: "nowpayments",
    purchaseType,
    checkoutId,
    reference,
    checkoutExperience: "embedded",
    widgetUrl: `https://nowpayments.io/embeds/payment-widget?iid=${encodeURIComponent(providerInvoiceId)}`,
    hostedUrl,
    credits: mkreditsFromCreditAtoms(credits),
    canonicalAmountMinor,
    canonicalCurrency: "USD",
    checkoutAmount: canonicalAmountMinor / 100,
    checkoutCurrency: "USD",
  }, 201);
}

async function startAssistKoraCheckout(input: {
  env: Env;
  customer: CustomerContext;
  session: Session;
  credits: number;
  canonicalAmountMinor: number;
  purchaseType: "plan" | "topup";
}) {
  const { env, customer, session, credits, canonicalAmountMinor, purchaseType } = input;
  if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "payment_provider_not_configured" }, 503);
  const checkoutId = id("chk");
  const reference = `ASSIST-MKA-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = unix();
  await env.DB.prepare(
    `INSERT INTO payment_checkouts
     (id,customer_id,user_id,reference,provider,credits,canonical_amount_minor,canonical_currency,status,created_at,purchase_type)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(checkoutId, customer.customerId, session.userId, reference, "kora", credits, canonicalAmountMinor, "USD", "pending", now, purchaseType).run();

  const response = await fetch("https://mkety.com/api/payments/kora/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: "assist",
      reference,
      canonical_amount_usd: (canonicalAmountMinor / 100).toFixed(2),
      email: session.email,
      customer_name: customer.customerName,
      checkout_id: checkoutId,
    }),
  });
  const payload = await response.json<any>().catch(() => null);
  const checkoutUrl = String(payload?.checkout_url || "");
  if (!response.ok || !payload?.success || !checkoutUrl.startsWith("https://mkety.com/")) {
    await env.DB.prepare("UPDATE payment_checkouts SET status='failed' WHERE id=? AND status='pending'").bind(checkoutId).run();
    return json({ error: "kora_checkout_failed", message: String(payload?.message || "Kora checkout could not be prepared.") }, 502);
  }
  await env.DB.prepare(
    "UPDATE payment_checkouts SET provider_amount_minor=?,provider_currency=? WHERE id=? AND status='pending'",
  ).bind(canonicalAmountMinor, "USD", checkoutId).run();
  return json({
    ok: true, provider: "kora", purchaseType, checkoutId, reference,
    checkoutExperience: "hosted", checkoutUrl, credits: mkreditsFromCreditAtoms(credits),
    canonicalAmountMinor, canonicalCurrency: "USD",
    checkoutAmount: canonicalAmountMinor / 100, checkoutCurrency: "USD",
  }, 201);
}

async function startAssistFlutterwaveCheckout(input: {
  env: Env;
  customer: CustomerContext;
  session: Session;
  credits: number;
  canonicalAmountMinor: number;
  paymentCurrency: string;
  purchaseType: "plan" | "topup";
}) {
  const { env, customer, session, credits, canonicalAmountMinor, paymentCurrency, purchaseType } = input;
  const allowedCurrencies = new Set(["USD","NGN","GHS","KES","GBP","EUR","ZAR","XAF","XOF","UGX","RWF","TZS","MWK","EGP"]);
  if (!allowedCurrencies.has(paymentCurrency)) return json({ error: "invalid_payment_currency" }, 400);
  const checkoutId = id("chk");
  const reference = `ASSIST-MKA-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = unix();
  await env.DB.prepare(
    `INSERT INTO payment_checkouts
     (id,customer_id,user_id,reference,provider,credits,canonical_amount_minor,canonical_currency,status,created_at,purchase_type)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(checkoutId, customer.customerId, session.userId, reference, "flutterwave", credits, canonicalAmountMinor, "USD", "pending", now, purchaseType).run();

  const requestBroker = async (experience: "inline" | "hosted") => {
    const brokerUrl = String(env.FLUTTERWAVE_CHECKOUT_BROKER_URL || "https://mkety.com/api/payments/flutterwave/start");
    const response = await fetch(brokerUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source: "assist",
        reference,
        canonical_amount_usd: (canonicalAmountMinor / 100).toFixed(2),
        requested_payment_currency: paymentCurrency,
        email: session.email,
        customer_name: customer.customerName,
        checkout_id: checkoutId,
        redirect_url: `https://${env.PORTAL_CNAME_TARGET}/payment/return?reference=${encodeURIComponent(reference)}`,
        checkout_experience: experience,
      }),
    });
    const payload = await response.json<any>().catch(() => null);
    return { response, payload };
  };

  let { response, payload } = await requestBroker("inline");
  const inline = payload?.inline;
  const inlineReady = Boolean(
    response.ok && payload?.success && inline?.publicKey && inline?.reference &&
    Number(inline?.amount) > 0 && inline?.currency && inline?.email && inline?.payloadHash
  );
  let checkoutUrl = "";
  if (!inlineReady) {
    ({ response, payload } = await requestBroker("hosted"));
    checkoutUrl = String(payload?.url || payload?.checkout_url || "");
  }

  const checkoutCurrency = String(payload?.currency || payload?.checkout_currency || "").toUpperCase();
  const checkoutAmount = Number(payload?.amount ?? payload?.checkout_amount ?? NaN);
  if (!response.ok || !payload?.success || (!inlineReady && !checkoutUrl) || !allowedCurrencies.has(checkoutCurrency) || !Number.isFinite(checkoutAmount) || checkoutAmount <= 0) {
    await env.DB.prepare("UPDATE payment_checkouts SET status='failed' WHERE id=? AND status='pending'").bind(checkoutId).run();
    return json({ error: "flutterwave_checkout_failed", message: String(payload?.message || "Flutterwave checkout could not be prepared.") }, 502);
  }
  if (checkoutCurrency !== paymentCurrency) {
    await env.DB.prepare("UPDATE payment_checkouts SET status='failed' WHERE id=? AND status='pending'").bind(checkoutId).run();
    return json({ error: "currency_quote_unavailable", requestedCurrency: paymentCurrency, checkoutCurrency }, 409);
  }

  const providerAmountMinor = Math.round(checkoutAmount * 100);
  await env.DB.prepare(
    "UPDATE payment_checkouts SET provider_amount_minor=?,provider_currency=? WHERE id=? AND status='pending'",
  ).bind(providerAmountMinor, checkoutCurrency, checkoutId).run();

  return json({
    ok: true,
    purchaseType,
    checkoutId,
    reference,
    checkoutExperience: inlineReady ? "inline" : "hosted",
    inline: inlineReady ? inline : null,
    checkoutUrl: inlineReady ? "" : checkoutUrl,
    credits: mkreditsFromCreditAtoms(credits),
    canonicalAmountMinor,
    canonicalCurrency: "USD",
    checkoutAmount,
    checkoutCurrency,
    providerAmountMinor,
    providerCurrency: checkoutCurrency,
  }, 201);
}

async function handleFlutterwavePaymentWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "payment_attestation_not_configured" }, 503);
  const raw = await request.text();
  const supplied = request.headers.get("x-mkety-payment-attestation") || "";
  if (!(await verifyPaymentAttestation(raw, supplied, env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET))) {
    return json({ error: "invalid_payment_attestation" }, 401);
  }

  let payload: Record<string, any>;
  try { payload = JSON.parse(raw) as Record<string, any>; }
  catch { return json({ error: "invalid_json" }, 400); }

  if (String(payload.event || "") !== "charge.completed") {
    return json({ ok: true, ignored: true });
  }
  const data = payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "invalid_payment_payload" }, 400);

  const reference = String(data.tx_ref || "");
  const checkout = await env.DB.prepare(
    "SELECT * FROM payment_checkouts WHERE reference=? AND provider='flutterwave' LIMIT 1",
  ).bind(reference).first<any>();
  if (!checkout) return json({ error: "unknown_payment_reference" }, 404);
  if (checkout.status === "paid") return json({ ok: true, duplicate: true });

  const status = String(data.status || "").toLowerCase();
  const providerCurrency = String(data.currency || "").toUpperCase();
  const providerAmountMinor = parsePaymentAmountMinor(data.amount ?? data.charged_amount);
  const expectedCurrency = String(checkout.provider_currency || checkout.canonical_currency || "").toUpperCase();
  const expectedAmountMinor = parseInt(String(checkout.provider_amount_minor || checkout.canonical_amount_minor || 0), 10);

  if (!expectedCurrency || providerCurrency !== expectedCurrency || providerAmountMinor < expectedAmountMinor) {
    return json({ error: "payment_quote_mismatch" }, 400);
  }

  const now = unix();
  if (status === "failed") {
    await env.DB.prepare(
      "UPDATE payment_checkouts SET status='failed',provider_payment_id=?,provider_event_id=?,settled_at=? WHERE id=? AND status='pending'",
    ).bind(String(data.id || ""), String(data.id || ""), now, checkout.id).run();
    return json({ ok: true, settled: false, status });
  }
  if (status !== "successful") {
    return json({ ok: true, settled: false, status: "pending" });
  }

  const updated = await env.DB.prepare(
    `UPDATE payment_checkouts
     SET status='paid',provider_payment_id=?,provider_event_id=?,settled_at=?
     WHERE id=? AND status='pending'`,
  ).bind(String(data.id || ""), String(data.id || ""), now, checkout.id).run();

  return json({ ok: true, settled: Boolean(updated.meta.changes), duplicate: !updated.meta.changes });
}

async function handleNowPaymentsPaymentWebhook(request: Request, env: Env): Promise<Response> {
  const secret = String(env.NOWPAYMENTS_IPN_SECRET || "");
  const signature = request.headers.get("x-nowpayments-sig") || "";
  if (!secret || !signature) return json({ error: "payment_signature_missing" }, 401);

  const payload = await request.json().catch(() => null) as any;
  if (!payload || !(await verifyNowPaymentsSignature(payload, signature, secret))) {
    return json({ error: "invalid_payment_signature" }, 401);
  }

  const status = String(payload.payment_status || "").toLowerCase();
  if (status !== "finished") return json({ ok: true, settled: false, status });

  const paymentId = String(payload.payment_id || "");
  const reference = String(payload.order_id || "");
  if (!paymentId || !reference) return json({ error: "invalid_payment_payload" }, 400);

  const checkout = await env.DB.prepare(
    "SELECT * FROM payment_checkouts WHERE reference=? AND provider='nowpayments' LIMIT 1",
  ).bind(reference).first<any>();
  if (!checkout) return json({ error: "unknown_payment_reference" }, 404);
  if (checkout.status === "paid") return json({ ok: true, settled: true, duplicate: true });

  const actualAmountMinor = parsePaymentAmountMinor(payload.price_amount);
  const expectedAmountMinor = Number(checkout.canonical_amount_minor || 0);
  if (actualAmountMinor + 1 < expectedAmountMinor) return json({ error: "payment_quote_mismatch" }, 400);

  const settlementKey = `nowpayments:${paymentId}`;
  const updated = await env.DB.prepare(
    "UPDATE payment_checkouts SET status='paid',provider_payment_id=?,provider_event_id=?,settled_at=?,settlement_key=? WHERE id=? AND status='pending'",
  ).bind(paymentId, paymentId, unix(), settlementKey, checkout.id).run();

  return json({ ok: true, settled: Boolean(updated.meta.changes), duplicate: !updated.meta.changes });
}

async function handleKoraPaymentWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "payment_attestation_not_configured" }, 503);
  const raw = await request.text();
  const supplied = request.headers.get("x-mkety-payment-attestation") || "";
  if (!(await verifyPaymentAttestation(raw, supplied, env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET))) {
    return json({ error: "invalid_payment_attestation" }, 401);
  }
  let payload: Record<string, any>;
  try { payload = JSON.parse(raw) as Record<string, any>; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (String(payload.provider || "") !== "kora") return json({ error: "invalid_payment_provider" }, 400);

  const reference = String(payload.reference || "");
  const checkout = await env.DB.prepare(
    "SELECT * FROM payment_checkouts WHERE reference=? AND provider='kora' LIMIT 1",
  ).bind(reference).first<any>();
  if (!checkout) return json({ error: "unknown_payment_reference" }, 404);
  if (checkout.status === "paid") return json({ ok: true, duplicate: true });

  const status = String(payload.status || "").toLowerCase();
  const amountMinor = parsePaymentAmountMinor(payload.amount);
  const currency = String(payload.currency || "").toUpperCase();
  if (currency !== String(checkout.canonical_currency || "USD").toUpperCase() || amountMinor < Number(checkout.canonical_amount_minor || 0)) {
    return json({ error: "payment_quote_mismatch" }, 400);
  }
  if (status === "failed") {
    await env.DB.prepare(
      "UPDATE payment_checkouts SET status='failed',provider_payment_id=?,provider_event_id=?,settled_at=? WHERE id=? AND status='pending'",
    ).bind(String(payload.provider_payment_id || ""), String(payload.provider_event_id || ""), unix(), checkout.id).run();
    return json({ ok: true, settled: false, status });
  }
  if (status !== "success") return json({ ok: true, settled: false, status: "pending" });

  const settlementKey = `kora:${String(payload.provider_event_id || payload.provider_payment_id || reference)}`;
  const updated = await env.DB.prepare(
    "UPDATE payment_checkouts SET status='paid',provider_payment_id=?,provider_event_id=?,settled_at=?,settlement_key=? WHERE id=? AND status='pending'",
  ).bind(String(payload.provider_payment_id || ""), String(payload.provider_event_id || ""), unix(), settlementKey, checkout.id).run();
  return json({ ok: true, settled: Boolean(updated.meta.changes), duplicate: !updated.meta.changes });
}

async function handlePaymentReturn(url: URL, env: Env): Promise<Response> {
  const reference = String(url.searchParams.get("reference") || "");
  const checkout = reference
    ? await env.DB.prepare(
        `SELECT pc.customer_id,pc.status,d.hostname
         FROM payment_checkouts pc
         JOIN customer_domains d ON d.customer_id=pc.customer_id AND d.is_primary=1
         WHERE pc.reference=? LIMIT 1`,
      ).bind(reference).first<any>()
    : null;
  const destination = checkout?.hostname
    ? `https://${checkout.hostname}/?payment=${encodeURIComponent(reference)}&status=${encodeURIComponent(String(checkout.status || "pending"))}`
    : `https://${env.PORTAL_CNAME_TARGET}/`;
  return Response.redirect(destination, 302);
}

async function recordAuthFailure(db: D1Database, scopeKey: string, now: number) {
  const current = await db.prepare(
    "SELECT attempts,window_started_at FROM auth_rate_limits WHERE scope_key=? LIMIT 1",
  ).bind(scopeKey).first<any>();
  const withinWindow = current && now - Number(current.window_started_at || 0) < 900;
  const attempts = (withinWindow ? Number(current.attempts || 0) : 0) + 1;
  const windowStarted = withinWindow ? Number(current.window_started_at) : now;
  const blockedUntil = attempts >= 5 ? now + 900 : null;
  await db.prepare(
    `INSERT INTO auth_rate_limits(scope_key,attempts,window_started_at,blocked_until)
     VALUES (?,?,?,?)
     ON CONFLICT(scope_key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`,
  ).bind(scopeKey, attempts, windowStarted, blockedUntil).run();
}

async function verifyPaymentAttestation(raw: string, signature: string, secret: string) {
  if (!raw || !signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(raw));
  const expected = arrayBufferToBase64(signed);
  return constantTimeEqual(expected, signature.trim());
}

function arrayBufferToBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function parsePaymentAmountMinor(value: unknown) {
  const raw = typeof value === "number" ? value.toFixed(2) : String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new HttpError(400, "invalid_payment_amount");
  return parseInt(match[1], 10) * 100 + parseInt((match[2] || "").padEnd(2, "0") || "0", 10);
}

async function deleteHostedWorkerDomain(env: Env, hostnameInput: string) {
  const hostname = normalizeHostname(hostnameInput);
  const headers = {
    authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}`,
    "content-type": "application/json",
  };
  const list = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.MKETY_ASSIST_CF_ACCOUNT_ID}/workers/domains`,
    { headers },
  );
  const data: any = await list.json();
  if (!list.ok || !data.success) {
    throw new Error(`Cloudflare Worker Custom Domain lookup failed during delete: ${JSON.stringify(data.errors || data)}`);
  }
  const existing = (data.result || []).find((item: any) => item.hostname === hostname);
  if (!existing) return;
  if (existing.service && existing.service !== env.APP_WORKER_NAME) {
    throw new Error(`Refusing to delete hosted domain ${hostname}; it belongs to ${existing.service}`);
  }
  const del = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.MKETY_ASSIST_CF_ACCOUNT_ID}/workers/domains/${existing.id}`,
    { method: "DELETE", headers },
  );
  const deleted: any = await del.json();
  if (!del.ok || !deleted.success) {
    throw new Error(`Cloudflare Worker Custom Domain delete failed for ${hostname}: ${JSON.stringify(deleted.errors || deleted)}`);
  }
}

async function ensureHostedWorkerDomain(env: Env, hostnameInput: string) {
  const hostname = normalizeHostname(hostnameInput);
  if (!hostname.endsWith(`.${env.HOSTED_SUFFIX}`)) throw new HttpError(400, "invalid_hosted_hostname");
  const headers = {
    authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}`,
    "content-type": "application/json",
  };
  const list = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.MKETY_ASSIST_CF_ACCOUNT_ID}/workers/domains`,
    { headers },
  );
  const data: any = await list.json();
  if (!list.ok || !data.success) {
    throw new Error(`Cloudflare Worker Custom Domain lookup failed: ${JSON.stringify(data.errors || data)}`);
  }
  const existing = (data.result || []).find((item: any) => item.hostname === hostname);
  if (existing?.service === env.APP_WORKER_NAME) return existing;
  if (existing && existing.service && existing.service !== env.APP_WORKER_NAME) {
    throw new Error(`Hosted domain ${hostname} is already attached to another Worker.`);
  }
  const payload = {
    hostname,
    service: env.APP_WORKER_NAME,
    zone_id: env.MKETY_ASSIST_CF_ZONE_ID,
    zone_name: "mkety.app",
  };
  const attach = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.MKETY_ASSIST_CF_ACCOUNT_ID}/workers/domains`,
    { method: "PUT", headers, body: JSON.stringify(payload) },
  );
  const attached: any = await attach.json();
  if (!attach.ok || !attached.success || !attached.result?.id) {
    throw new Error(`Cloudflare Worker Custom Domain attach failed for ${hostname}: ${JSON.stringify(attached.errors || attached)}`);
  }
  return attached.result;
}

async function deleteCustomerR2Objects(bucket: R2Bucket, customerId: string) {
  for (const prefix of [`knowledge/${customerId}/`, `media/${customerId}/`]) {
    let cursor: string | undefined;
    do {
      const listed = await bucket.list({ prefix, cursor, limit: 1000 });
      const keys = listed.objects.map((object) => object.key);
      if (keys.length) await bucket.delete(keys);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
}

async function deleteCustomHostnameInfrastructure(env: Env, hostnameInput: string, providerHostnameId: string | null) {
  const hostname = normalizeHostname(hostnameInput);
  const headers = {
    authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}`,
    "content-type": "application/json",
  };

  let hostnameId = providerHostnameId;
  if (!hostnameId) {
    const lookup = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
      { headers },
    );
    const data: any = await lookup.json();
    if (!lookup.ok || !data.success) {
      throw new Error(`Cloudflare Custom Hostname lookup failed during delete: ${JSON.stringify(data.errors || data)}`);
    }
    const matches = data.result || [];
    if (matches.length > 1) throw new Error(`Multiple Cloudflare Custom Hostnames exist for ${hostname}`);
    hostnameId = matches[0]?.id || null;
  }

  if (hostnameId) {
    const del = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames/${hostnameId}`,
      { method: "DELETE", headers },
    );
    const data: any = await del.json();
    if (!del.ok || !data.success) {
      throw new Error(`Cloudflare Custom Hostname delete failed: ${JSON.stringify(data.errors || data)}`);
    }
  }
}

async function createCustomHostname(env: Env, customerId: string, hostnameInput: string) {
  const hostname = normalizeHostname(hostnameInput);
  const now = unix();
  const headers = {
    authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}`,
    "content-type": "application/json",
  };

  // Cloudflare for SaaS routes the customer's hostname to the stable Assist origin.
  // Do not create a Worker route for the customer's external hostname inside the mkety.app zone.
  const hostLookup = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
    { headers },
  );
  const hostLookupData: any = await hostLookup.json();
  if (!hostLookup.ok || !hostLookupData.success) {
    throw new Error(`Cloudflare custom hostname lookup failed: ${JSON.stringify(hostLookupData.errors || hostLookupData)}`);
  }
  if ((hostLookupData.result || []).length > 1) {
    throw new Error(`Multiple Cloudflare Custom Hostname records exist for ${hostname}`);
  }

  let result = hostLookupData.result?.[0] ?? null;
  if (!result) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          hostname,
          ssl: { method: "http", type: "dv" },
          custom_origin_server: env.ROUTING_ORIGIN,
        }),
      },
    );
    const data: any = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(`Cloudflare custom hostname creation failed: ${JSON.stringify(data.errors || data)}`);
    }
    result = data.result;
  }

  const validation = {
    ownership_verification: result.ownership_verification ?? null,
    ssl_validation_records: result.ssl?.validation_records ?? null,
    cname_target: env.PORTAL_CNAME_TARGET,
    routing_origin: env.ROUTING_ORIGIN,
    worker_route: `${env.ROUTING_ORIGIN}/*`,
  };

  const existing = await env.DB.prepare("SELECT id,status,verified_at FROM customer_domains WHERE hostname=? LIMIT 1").bind(hostname).first<any>();
  const providerProjectedStatus = result.status === "active" ? "active" : "pending";
  const persistedStatus = existing?.verified_at || existing?.status === "active" ? "active" : providerProjectedStatus;
  await env.DB.batch([
    env.DB.prepare("UPDATE customer_domains SET is_primary=0 WHERE customer_id=?").bind(customerId),
    existing
      ? env.DB.prepare(
          "UPDATE customer_domains SET customer_id=?,kind='custom',is_primary=1,status=?,ssl_status=?,provider_hostname_id=?,validation_json=?,verified_at=CASE WHEN ?='active' THEN COALESCE(verified_at,?) ELSE verified_at END WHERE id=?",
        ).bind(customerId, persistedStatus, result.ssl?.status || null, result.id, JSON.stringify(validation), persistedStatus, now, existing.id)
      : env.DB.prepare(
          "INSERT INTO customer_domains (id,customer_id,hostname,kind,is_primary,status,ssl_status,provider_hostname_id,validation_json,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(id("dom"), customerId, hostname, "custom", 1, providerProjectedStatus, result.ssl?.status || null, result.id, JSON.stringify(validation), now, result.status === "active" ? now : null),
  ]);

  return {
    hostname,
    status: persistedStatus,
    sslStatus: result.ssl?.status ?? null,
    cnameTarget: env.PORTAL_CNAME_TARGET,
    routingOrigin: env.ROUTING_ORIGIN,
    workerRoute: `${env.ROUTING_ORIGIN}/*`,
    validation,
  };
}

async function resolveCustomerByHost(db: D1Database, host: string, hostedSuffix: string): Promise<CustomerContext | null> {
  const direct = await db.prepare(
    `SELECT c.id AS customer_id,c.slug,c.name,d.hostname
     FROM customer_domains d JOIN customers c ON c.id=d.customer_id
     WHERE d.hostname=? AND d.status IN ('active','pending') AND c.status='active' LIMIT 1`,
  ).bind(host).first<any>();
  if (direct) return { customerId: direct.customer_id, customerSlug: direct.slug, customerName: direct.name, hostname: direct.hostname, brandColor: direct.brand_color, logoUrl: direct.logo_url };

  if (host.endsWith(`.${hostedSuffix}`)) {
    const slug = host.slice(0, -1 * (`.${hostedSuffix}`.length));
    if (slug && !slug.includes(".")) {
      const row = await db.prepare(
        "SELECT id,slug,name,brand_color,logo_url FROM customers WHERE slug=? AND status='active' LIMIT 1",
      ).bind(slug).first<any>();
      if (row) return { customerId: row.id, customerSlug: row.slug, customerName: row.name, hostname: host, brandColor: row.brand_color, logoUrl: row.logo_url };
    }
  }
  return null;
}

type ControlState = "active" | "paused" | "suspended" | "banned";

function normalizeControlState(value: unknown): ControlState {
  const state = String(value || "").toLowerCase();
  if (!["active","paused","suspended","banned"].includes(state)) throw new HttpError(400, "invalid_control_state");
  return state as ControlState;
}

function normalizeOptionalExpiry(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const ms = typeof value === "number" ? Number(value) * 1000 : Date.parse(String(value));
  const seconds = Math.floor(ms / 1000);
  if (!Number.isFinite(seconds) || seconds <= unix()) throw new HttpError(400, "invalid_control_expiry");
  return seconds;
}

async function effectiveAccountControl(db: D1Database, customerId: string, userId: string) {
  const row = await db.prepare(
    "SELECT state,reason,expires_at FROM account_controls WHERE customer_id=? AND user_id=? LIMIT 1",
  ).bind(customerId, userId).first<any>();
  if (!row) return { state: "active" as ControlState, reason: null as string | null, expiresAt: null as number | null };
  const expiresAt = row.expires_at === null || row.expires_at === undefined ? null : Number(row.expires_at);
  if (expiresAt && expiresAt <= unix()) {
    await db.prepare(
      "UPDATE account_controls SET state='active',reason=NULL,expires_at=NULL,updated_at=? WHERE customer_id=? AND user_id=?",
    ).bind(unix(), customerId, userId).run();
    return { state: "active" as ControlState, reason: null, expiresAt: null };
  }
  return { state: String(row.state) as ControlState, reason: row.reason ? String(row.reason) : null, expiresAt };
}

async function setAccountControl(db: D1Database, input: {
  customerId: string; userId: string; state: ControlState; reason: string | null; expiresAt: number | null; operatorId?: string | null;
}) {
  const now = unix();
  await db.prepare(
    `INSERT INTO account_controls(customer_id,user_id,state,reason,expires_at,updated_by_operator_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(customer_id,user_id) DO UPDATE SET
       state=excluded.state,reason=excluded.reason,expires_at=excluded.expires_at,
       updated_by_operator_id=excluded.updated_by_operator_id,updated_at=excluded.updated_at`,
  ).bind(input.customerId,input.userId,input.state,input.reason,input.expiresAt,input.operatorId || null,now,now).run();
}

async function setSenderControl(db: D1Database, input: {
  customerId: string; assistantId: string; channel: string; senderId: string; state: ControlState; reason: string | null; expiresAt: number | null; operatorId?: string | null;
}) {
  const now = unix();
  await db.prepare(
    `INSERT INTO channel_sender_controls(customer_id,assistant_id,channel,sender_id,state,reason,expires_at,updated_by_operator_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(assistant_id,channel,sender_id) DO UPDATE SET
       state=excluded.state,reason=excluded.reason,expires_at=excluded.expires_at,
       updated_by_operator_id=excluded.updated_by_operator_id,updated_at=excluded.updated_at`,
  ).bind(input.customerId,input.assistantId,input.channel,input.senderId,input.state,input.reason,input.expiresAt,input.operatorId || null,now,now).run();
}

async function requireSession(request: Request, env: Env, customerId: string): Promise<Session | null> {
  const token = getSessionCookie(request, env);
  if (!token) return null;
  const now = unix();
  const row = await env.DB.prepare(
    `SELECT s.user_id,s.customer_id,u.email,cu.role FROM sessions s
     JOIN users u ON u.id=s.user_id
     JOIN customer_users cu ON cu.user_id=s.user_id AND cu.customer_id=s.customer_id
     WHERE s.token_hash=? AND s.customer_id=? AND s.expires_at>? AND s.revoked_at IS NULL AND u.status='active' LIMIT 1`,
  ).bind(await sha256(token), customerId, now).first<any>();
  if (!row) return null;
  const control = await effectiveAccountControl(env.DB, customerId, String(row.user_id));
  if (control.state !== "active") return null;
  return { userId: row.user_id, customerId: row.customer_id, role: row.role, email: row.email };
}

async function issueSession(env: Env, customerId: string, userId: string, role: Session["role"], email: string): Promise<Response> {
  const token = randomToken(32);
  const now = unix();
  const ttl = Number(env.SESSION_TTL_SECONDS || "2592000");
  await env.DB.prepare(
    "INSERT INTO sessions (id,token_hash,user_id,customer_id,expires_at,created_at,last_seen_at,user_agent) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(id("ses"), await sha256(token), userId, customerId, now + ttl, now, now, null).run();
  return new Response(JSON.stringify({ ok: true, role, email }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${env.SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`,
    },
  });
}

function getSessionCookie(request: Request, env: Env): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === env.SESSION_COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}

function clearSessionCookie(env: Env) {
  return `${env.SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function sendTelegramRecoveryCode(botToken: string, telegramUserId: string, customerName: string, code: string): Promise<boolean> {
  return sendTelegramTextWithToken(
    botToken,
    telegramUserId,
    `${customerName} access recovery code: ${code}\n\nThis code expires in 10 minutes. If you did not request it, ignore this message.`,
  );
}

async function sendTelegramText(env: Env, telegramUserId: string, text: string): Promise<boolean> {
  return sendTelegramTextWithToken(env.MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN || "", telegramUserId, text);
}

async function sendTelegramTextWithToken(botToken: string, telegramUserId: string, text: string): Promise<boolean> {
  if (!botToken) return false;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: telegramUserId, text }),
  });
  return response.ok;
}

async function hashPassword(password: string, env: Env) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pepper = env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY;
  if (!pepper) throw new Error("password_pepper_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const material = new Uint8Array(salt.byteLength + encoder.encode(password).byteLength);
  material.set(salt, 0);
  material.set(encoder.encode(password), salt.byteLength);
  const signature = await crypto.subtle.sign("HMAC", key, material);
  // iterations=0 is the version marker for the server-peppered HMAC scheme.
  return { hash: bytesToHex(new Uint8Array(signature)), salt: bytesToHex(salt), iterations: 0 };
}

async function verifyPassword(password: string, saltHex: string, iterations: number, expectedHash: string, env: Env) {
  const salt = hexToBytes(saltHex);
  const version = Number(iterations);
  if (version === 0) {
    const pepper = env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY;
    if (!pepper) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const passwordBytes = encoder.encode(password);
    const material = new Uint8Array(salt.byteLength + passwordBytes.byteLength);
    material.set(salt, 0);
    material.set(passwordBytes, salt.byteLength);
    const signature = await crypto.subtle.sign("HMAC", key, material);
    return constantTimeEqual(bytesToHex(new Uint8Array(signature)), String(expectedHash));
  }

  // Backward compatibility for passwords created before the Worker-safe scheme.
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: version }, key, 256);
  return constantTimeEqual(bytesToHex(new Uint8Array(bits)), String(expectedHash));
}

function validatePassword(password: string) {
  if (password.length < 12 || password.length > 200) throw new HttpError(400, "password_must_be_at_least_12_characters");
}

async function sha256(input: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input))));
}

async function hmacHex(secret: string, input: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input))));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function requireOperatorSession(request: Request, env: Env) {
  const token = getNamedCookie(request, env.OPS_SESSION_COOKIE_NAME);
  if (!token) return null;
  const now = unix();
  const row = await env.DB.prepare(
    `SELECT s.operator_user_id,u.email FROM operator_sessions s
     JOIN operator_users u ON u.id=s.operator_user_id
     WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' LIMIT 1`,
  ).bind(await sha256(token), now).first<any>();
  return row ? { operatorUserId: row.operator_user_id, email: row.email } : null;
}

async function issueOperatorSessionRedirect(env: Env, operatorUserId: string, email: string, destination: string) {
  const response = await issueOperatorSession(env, operatorUserId, email);
  const cookie = response.headers.get("set-cookie");
  const headers = new Headers({ location: destination, "cache-control": "no-store" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function issueOperatorSession(env: Env, operatorUserId: string, email: string) {
  const token = randomToken(32);
  const now = unix();
  const ttl = Number(env.SESSION_TTL_SECONDS || "2592000");
  await env.DB.prepare(
    "INSERT INTO operator_sessions (id,token_hash,operator_user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)",
  ).bind(id("opses"), await sha256(token), operatorUserId, now + ttl, now, now).run();
  return new Response(JSON.stringify({ ok: true, email }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${env.OPS_SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`,
    },
  });
}

function getNamedCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

function clearNamedCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function readJson(request: Request): Promise<Record<string, any>> {
  try { return await request.json() as Record<string, any>; }
  catch { throw new HttpError(400, "invalid_json"); }
}

function requiredString(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new HttpError(400, `missing_${field}`);
  return text;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "invalid_email");
  return email;
}

function normalizeSlug(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  if (!slug) throw new HttpError(400, "invalid_slug");
  return slug;
}

function normalizeHostname(value: string) {
  const host = value.toLowerCase().trim().replace(/\.$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw new HttpError(400, "invalid_hostname");
  }
  return host;
}

function optionalHostname(value: unknown) {
  return typeof value === "string" && value.trim() ? normalizeHostname(value) : null;
}

const MKREDITS_PER_USD = 1_000;
const CREDIT_ATOMS_PER_USD = 10_000_000;
const CREDIT_ATOMS_PER_MKREDIT = CREDIT_ATOMS_PER_USD / MKREDITS_PER_USD;

function creditAtomsFromMkredits(value: unknown) {
  const mkredits = Number(value || 0);
  if (!Number.isFinite(mkredits) || mkredits < 0) throw new HttpError(400, "invalid_mkredit_value");
  return Math.round(mkredits * CREDIT_ATOMS_PER_MKREDIT);
}

function mkreditsFromCreditAtoms(value: unknown) {
  const atoms = Number(value || 0);
  if (!Number.isFinite(atoms)) return 0;
  return Math.round((atoms / CREDIT_ATOMS_PER_MKREDIT) * 10000) / 10000;
}

function creditAtomsFromUsdMicros(usdMicros: number) {
  if (usdMicros <= 0) return 0;
  return Math.ceil((usdMicros * CREDIT_ATOMS_PER_USD) / 1_000_000);
}

function creditAtomsFromUsdMinor(amountMinor: number) {
  if (amountMinor <= 0) return 0;
  return Math.floor((amountMinor * CREDIT_ATOMS_PER_USD) / 100);
}

function usdMinorFromCreditAtoms(atoms: number) {
  if (atoms <= 0) return 0;
  return Math.ceil((atoms * 100) / CREDIT_ATOMS_PER_USD);
}

function calculateCommercialPlan(input: {
  monthlyAmountMinor: number;
  providerEnvelopeBps: number;
  operationsReserveBps: number;
  rateMultiplierBps: number;
}) {
  if (input.monthlyAmountMinor <= 0) throw new HttpError(400, "monthly_amount_must_be_positive");
  if (input.providerEnvelopeBps < 1 || input.providerEnvelopeBps > 10000) throw new HttpError(400, "provider_envelope_invalid");
  if (input.operationsReserveBps < 0 || input.operationsReserveBps >= 10000) throw new HttpError(400, "operations_reserve_invalid");
  if (input.rateMultiplierBps < 10000 || input.rateMultiplierBps > 100000) throw new HttpError(400, "rate_multiplier_invalid");
  const monthlyUsdMicros = input.monthlyAmountMinor * 10000;
  const providerEnvelopeUsdMicros = Math.floor(monthlyUsdMicros * input.providerEnvelopeBps / 10000);
  const usableProviderUsdMicros = Math.floor(providerEnvelopeUsdMicros * (10000 - input.operationsReserveBps) / 10000);
  const customerUsageValueUsdMicros = Math.floor(usableProviderUsdMicros * input.rateMultiplierBps / 10000);
  const includedCredits = creditAtomsFromUsdMicros(customerUsageValueUsdMicros);
  return {
    providerEnvelopeUsdMicros,
    usableProviderUsdMicros,
    customerUsageValueUsdMicros,
    includedCredits,
    includedMkredits: mkreditsFromCreditAtoms(includedCredits),
  };
}

function publicCreditFields<T extends Record<string, any>>(row: T): T {
  const out: any = deriveCustomerBaseRates({ ...row });
  for (const key of ["input_credits_per_million","output_credits_per_million","image_credits","audio_credits_per_minute","reasoning_credits_per_million"]) {
    if (key in out) out[key] = mkreditsFromCreditAtoms(out[key]);
  }
  return out;
}

async function protectStoredSecret(secret: string, configured: string) {
  const keyBytes = decodeStoredSecretKey(configured);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret)));
  return `mas1.${base64UrlBytes(iv)}.${base64UrlBytes(encrypted)}`;
}

async function revealStoredSecret(value: string, configured: string) {
  const [version, ivPart, dataPart, extra] = value.split(".");
  if (version !== "mas1" || !ivPart || !dataPart || extra) throw new HttpError(500, "invalid_encrypted_secret");
  const key = await crypto.subtle.importKey("raw", decodeStoredSecretKey(configured), { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = decodeBase64UrlBytes(ivPart);
  const encrypted = decodeBase64UrlBytes(dataPart);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(plain);
}

function decodeBase64UrlBytes(value: string) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "===".slice((raw.length + 3) % 4);
  return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
}

function decodeStoredSecretKey(value: string) {
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const raw = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "===".slice((raw.length + 3) % 4);
  const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  if (bytes.length !== 32) throw new HttpError(500, "invalid_secret_encryption_key");
  return bytes;
}

function base64UrlBytes(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseUsdMinorValue(value: unknown, label: string, allowZero = false) {
  const text = String(value ?? "").trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new HttpError(400, `invalid_${label.replace(/\s+/g, "_")}`);
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  if (allowZero ? amount < 0 : amount <= 0) throw new HttpError(400, `invalid_${label.replace(/\s+/g, "_")}`);
  return amount;
}

function parsePercentBpsValue(value: unknown, fallbackPercent: number, minPercent: number, maxPercent: number) {
  const text = String(value ?? "").trim();
  if (!text) return Math.round(fallbackPercent * 100);
  const number = Number(text);
  if (!Number.isFinite(number) || number < minPercent || number > maxPercent) throw new HttpError(400, "invalid_percentage");
  return Math.round(number * 100);
}

function positiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function nullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "invalid_numeric_policy_value");
  return Math.floor(n);
}

function nullableBoolInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw new HttpError(400, "invalid_boolean_policy_value");
  return value ? 1 : 0;
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function randomToken(bytes: number) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unix() {
  return Math.floor(Date.now() / 1000);
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function assistEntryPage(hostedSuffix: string) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mkety Assist</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d13;color:#f7f7fb;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(460px,90vw);background:#151821;border:1px solid #292d3c;border-radius:18px;padding:28px;box-sizing:border-box}.brand{font-size:24px;font-weight:800;margin-bottom:6px}.muted{color:#9ca2b5}label{display:block;font-size:12px;color:#bac0cf;margin:18px 0 6px}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:10px;font:inherit}input{background:#0d0f16;border:1px solid #34394b;color:white}button{margin-top:10px;background:#7657ff;border:0;color:white;font-weight:700;cursor:pointer}.note{font-size:12px;color:#8e94a6;margin-top:18px}</style></head>
<body><main class="card"><div class="brand">Mkety Assist</div><p class="muted">Open your private AI assistant workspace.</p><form id="workspace"><label for="slug">Workspace</label><input id="slug" autocomplete="organization" placeholder="your-company" pattern="[a-z0-9][a-z0-9-]*" required><button>Continue</button></form><p id="msg" class="note">If your company uses its own custom domain, open that domain directly.</p></main>
<script>
const suffix=${JSON.stringify(hostedSuffix)};
workspace.onsubmit=(e)=>{e.preventDefault();const value=slug.value.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9-]*$/.test(value)){msg.textContent='Enter the workspace name provided by your administrator.';return;}location.href='https://'+value+'.'+suffix+'/';};
</script></body></html>`);
}

function operatorSetupPage(token: string) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Set up Mkety Assist Operator</title>
<style>body{font:16px system-ui;margin:0;background:#0d0e14;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(440px,90vw);background:#171924;padding:28px;border-radius:18px}input,button{box-sizing:border-box;width:100%;padding:12px;margin:7px 0;border-radius:10px;border:1px solid #34384a;background:#10121a;color:#fff}button{background:#6d4aff;border:0;font-weight:700;cursor:pointer}.muted{color:#a8adbd;font-size:14px}</style></head>
<body><main class="card"><h1>Mkety Assist Operator</h1><p class="muted">One-time Operator setup.</p><form id="setup"><input id="email" type="email" placeholder="Operator email" required><input id="password" type="password" minlength="12" placeholder="Choose password (12+ characters)" required><button>Create Operator access</button></form><p id="msg" class="muted"></p>
<script>const token=${JSON.stringify(token)};setup.onsubmit=async(e)=>{e.preventDefault();const r=await fetch('/api/ops/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,email:email.value,password:password.value})});if(r.ok)location.href='/';else msg.textContent='This setup link is invalid, expired, or already used.';};</script></main></body></html>`);
}

function operatorLoginPage() {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mkety Assist Operator</title>
<style>body{font:16px system-ui;margin:0;background:#0d0e14;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(420px,90vw);background:#171924;padding:28px;border-radius:18px}.button{box-sizing:border-box;width:100%;display:block;text-align:center;padding:12px;margin:18px 0 8px;border-radius:10px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:700}.muted{color:#a8adbd;font-size:14px}</style></head>
<body><main class="card"><h1>Mkety Assist Operator</h1><p class="muted">Internal administration · authorized Mkety identity only</p><a class="button" href="/api/ops/auth/login">Sign in with Mkety</a><p class="muted">Access is restricted to the approved Mkety Operator account.</p></main></body></html>`);
}

export function setupPage(customer: CustomerContext, token: string) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Set up ${escapeHtml(customer.customerName)} AI</title>
<style>body{font:16px system-ui;margin:0;background:#0d0e14;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(440px,90vw);background:#171924;padding:28px;border-radius:18px}input,button{box-sizing:border-box;width:100%;padding:12px;margin:7px 0;border-radius:10px;border:1px solid #34384a;background:#10121a;color:#fff}button{background:#6d4aff;border:0;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}.muted{color:#a8adbd;font-size:14px}.error{color:#ff9b9b}.ok{color:#6ee7b7}</style></head>
<body><main class="card"><h1>Set up your portal</h1><p class="muted">${escapeHtml(customer.customerName)} AI</p>
<p id="setupStatus" class="muted">Validating this access link…</p>
<form id="setupForm" style="display:none"><p id="ownerInfo" class="muted"></p><input id="setupPassword" type="password" minlength="12" placeholder="Choose password (12+ characters)" required><button id="setupSubmit" type="submit">Create access</button></form>
<p id="setupMsg" class="muted"></p>
<script>
const setupToken=${JSON.stringify(token)};
const form=document.getElementById('setupForm');
const passwordInput=document.getElementById('setupPassword');
const submitButton=document.getElementById('setupSubmit');
const statusEl=document.getElementById('setupStatus');
const msgEl=document.getElementById('setupMsg');
const ownerInfo=document.getElementById('ownerInfo');

async function validateSetupLink(){
  if(!setupToken){statusEl.className='error';statusEl.textContent='This access link is missing its token.';return}
  try{
    const r=await fetch('/api/auth/setup/validate?token='+encodeURIComponent(setupToken),{headers:{accept:'application/json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.valid){
      statusEl.className='error';
      statusEl.textContent='This setup link is invalid, expired, or already used.';
      return;
    }
    statusEl.className='ok';
    statusEl.textContent='Access link verified.';
    ownerInfo.textContent='Account: '+d.email+' · Link expires '+new Date(d.expiresAt*1000).toLocaleString();
    form.style.display='block';
  }catch(e){
    statusEl.className='error';
    statusEl.textContent='Could not validate this setup link. Please try again.';
  }
}

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  submitButton.disabled=true;
  msgEl.className='muted';
  msgEl.textContent='Creating your access…';
  try{
    const r=await fetch('/api/auth/setup',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify({token:setupToken,password:passwordInput.value})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      submitButton.disabled=false;
      msgEl.className='error';
      msgEl.textContent=d.error==='password_must_be_at_least_12_characters'
        ? 'Password must be at least 12 characters.'
        : d.error==='invalid_or_expired_setup_token'
          ? 'This setup link is invalid, expired, or already used.'
          : 'Could not create access: '+String(d.error||('HTTP '+r.status));
      return;
    }
    location.href='/';
  }catch(e){
    submitButton.disabled=false;
    msgEl.className='error';
    msgEl.textContent='Could not create access. Please try again.';
  }
});

validateSetupLink();
</script></main></body></html>`);
}

function loginPage(customer: CustomerContext) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(customer.customerName)} AI</title>
<style>body{font:16px system-ui;margin:0;background:#0d0e14;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(420px,90vw);background:#171924;padding:28px;border-radius:18px}input,button{box-sizing:border-box;width:100%;padding:12px;margin:7px 0;border-radius:10px;border:1px solid #34384a;background:#10121a;color:#fff}button{background:#6d4aff;border:0;font-weight:700;cursor:pointer}.muted{color:#a8adbd;font-size:14px}.error{color:#ff9b9b}</style></head>
<body><main class="card"><h1>${escapeHtml(customer.customerName)} AI</h1><p class="muted">Private assistant administration portal</p>
<form id="login"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" placeholder="Password" required><button>Sign in</button></form>
<p><button id="recover" type="button">Recover access with Telegram</button></p><p id="msg" class="muted"></p>
<script>
const msg=document.getElementById('msg');
document.getElementById('login').onsubmit=async(e)=>{e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});if(r.ok)location.reload();else msg.textContent='Sign in failed';};
document.getElementById('recover').onclick=async()=>{const e=prompt('Account email');if(!e)return;await fetch('/api/auth/recovery/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e})});const c=prompt('If Telegram is linked, enter the 6-digit code sent there');if(!c)return;const p=prompt('Choose a new password (12+ characters)');if(!p)return;const r=await fetch('/api/auth/recovery/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e,code:c,newPassword:p})});if(r.ok)location.reload();else msg.textContent='Recovery code invalid or expired';};
</script></main></body></html>`);
}

function dashboardPage(customer: CustomerContext, session: Session) {
  return html(renderCustomerPortal({
    customerName: customer.customerName,
    hostname: customer.hostname,
    email: session.email,
    role: session.role,
    brandColor: customer.brandColor ?? null,
    logoUrl: customer.logoUrl ?? null,
  }));
}

function opsPage(customers: any[]) {
  return html(renderOperatorPortal(customers));
}

function brandedNotFound(host: string) {
  return html(`<!doctype html><html><body style="font:16px system-ui;background:#0d0e14;color:white;display:grid;place-items:center;min-height:100vh"><main><h1>Portal unavailable</h1><p>No active Mkety Assist customer portal is configured for <code>${escapeHtml(host)}</code>.</p></main></body></html>`, 404);
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c] || c));
}
