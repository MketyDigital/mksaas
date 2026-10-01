/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleAssistantTelegramWebhook, handleRuntimeApi, processDueReminders, runtimeErrorResponse } from "./runtime";
import { renderCustomerPortal, renderOperatorPortal } from "./ui";

interface Env {
  DB: D1Database;
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
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_SECONDS: string;
  RECOVERY_TTL_SECONDS: string;
  MKETY_ASSIST_OPS_TOKEN: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_USERNAME?: string;
  MKETY_ASSIST_TELEGRAM_AUTH_WEBHOOK_SECRET: string;
  MKETY_ASSIST_CF_ZONE_ID: string;
  MKETY_ASSIST_CF_SAAS_TOKEN: string;
  MKETY_ASSIST_PAYMENT_WEBHOOK_SECRET: string;
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

      if (host === env.OPS_HOST) {
        return handleOps(request, env);
      }

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/telegram/auth-webhook" && request.method === "POST") {
        return handleTelegramAuthBotWebhook(request, env);
      }

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/api/payment/webhook" && request.method === "POST") {
        return handlePaymentWebhook(request, env);
      }

      const customer = await resolveCustomerByHost(env.DB, host, env.HOSTED_SUFFIX);
      if (!customer) return brandedNotFound(host);

      if (url.pathname.startsWith("/api/auth/")) {
        return handleAuth(request, env, customer);
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
      console.error("mkety-assist request failed", error);
      return json({ error: "internal_error" }, 500);
    }
  },
};

async function handleOps(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/" && request.method === "GET") {
    // The HTML shell contains no customer data. Operator data is fetched only
    // after the browser supplies the Operator bearer token (and Cloudflare
    // Access should additionally guard this hostname in production).
    return opsPage([]);
  }

  if (!isOpsAuthorized(request, env)) return json({ error: "not_found" }, 404);

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
    const hostedHostname = `${slug}.${env.HOSTED_SUFFIX}`;

    const monthlyPrice = positiveInt(body.monthlyPriceMinor, 0);
    const providerEnvelopeBps = positiveInt(body.providerEnvelopeBps, 2500);
    const operationsReserveBps = positiveInt(body.operationsReserveBps, 300);
    const rateMultiplierBps = positiveInt(body.rateMultiplierBps, 10000);
    let includedCredits = positiveInt(body.includedCredits, 0);
    if (body.autoCalculateCredits === true && monthlyPrice > 0) {
      const setting = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1").first<any>();
      const creditUsdMicros = Math.max(1, parseInt(String(JSON.parse(setting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10));
      includedCredits = calculateCommercialPlan({
        monthlyAmountMinor: monthlyPrice,
        providerEnvelopeBps,
        operationsReserveBps,
        rateMultiplierBps,
        creditUsdMicros,
      }).includedCredits;
    }
    const maxAssistants = Math.max(1, positiveInt(body.maxAssistants, 5));

    await env.DB.batch([
      env.DB.prepare("INSERT INTO customers (id,slug,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)")
        .bind(customerId, slug, name, "active", now, now),
      env.DB.prepare("INSERT INTO customer_domains (id,customer_id,hostname,kind,is_primary,status,ssl_status,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id("dom"), customerId, hostedHostname, "hosted", customHostname ? 0 : 1, "active", "active", now, now),
      env.DB.prepare("INSERT INTO users (id,email,status,created_at,updated_at) VALUES (?,?,?,?,?)")
        .bind(userId, adminEmail, "active", now, now),
      env.DB.prepare("INSERT INTO customer_users (customer_id,user_id,role,created_at) VALUES (?,?,?,?)")
        .bind(customerId, userId, "owner", now),
      env.DB.prepare("INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)")
        .bind(id("set"), customerId, userId, setupHash, now + 86400, now),
      env.DB.prepare("INSERT INTO credit_accounts (customer_id,balance,lifetime_granted,lifetime_consumed,updated_at) VALUES (?,?,?,?,?)")
        .bind(customerId, includedCredits, includedCredits, 0, now),
      env.DB.prepare("INSERT INTO commercial_policy (customer_id,subscription_amount_minor,included_credits,provider_envelope_bps,operations_reserve_bps,rate_multiplier_bps,updated_at) VALUES (?,?,?,?,?,?,?)")
        .bind(customerId, monthlyPrice, includedCredits, providerEnvelopeBps, operationsReserveBps, rateMultiplierBps, now),
      env.DB.prepare("INSERT INTO feature_policy (customer_id,max_assistants,updated_at) VALUES (?,?,?)")
        .bind(customerId, maxAssistants, now),
      env.DB.prepare("INSERT INTO audit_events (id,actor_type,action,target_type,target_id,customer_id,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id("aud"), "operator", "customer.created", "customer", customerId, customerId, now),
    ]);

    let customDomain: unknown = null;
    if (customHostname) {
      customDomain = await createCustomHostname(env, customerId, customHostname);
    }

    return json({
      customerId,
      hostedHostname,
      customDomain,
      setupUrl: `https://${hostedHostname}/setup?token=${encodeURIComponent(setupToken)}`,
    }, 201);
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
    return json({ customers: rows.results ?? [] });
  }

  if (url.pathname === "/api/ops/customer" && request.method === "GET") {
    const customerId = requiredString(url.searchParams.get("id"), "id");
    const customer = await env.DB.prepare("SELECT * FROM customers WHERE id=? LIMIT 1").bind(customerId).first();
    if (!customer) return json({ error: "customer_not_found" }, 404);
    const commercial = await env.DB.prepare("SELECT * FROM commercial_policy WHERE customer_id=?").bind(customerId).first();
    const features = await env.DB.prepare("SELECT * FROM feature_policy WHERE customer_id=?").bind(customerId).first();
    const credits = await env.DB.prepare("SELECT * FROM credit_accounts WHERE customer_id=?").bind(customerId).first();
    const domains = await env.DB.prepare("SELECT hostname,kind,is_primary,status,ssl_status,validation_json,verified_at FROM customer_domains WHERE customer_id=? ORDER BY is_primary DESC,created_at ASC").bind(customerId).all();
    return json({ customer, commercial, features, credits, domains: domains.results ?? [] });
  }

  if (url.pathname === "/api/ops/pricing/calculate" && request.method === "POST") {
    const body = await readJson(request);
    const setting = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1").first<any>();
    const creditUsdMicros = Math.max(1, parseInt(String(JSON.parse(setting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10));
    const result = calculateCommercialPlan({
      monthlyAmountMinor: positiveInt(body.monthlyAmountMinor, 0),
      providerEnvelopeBps: positiveInt(body.providerEnvelopeBps, 2500),
      operationsReserveBps: positiveInt(body.operationsReserveBps, 300),
      rateMultiplierBps: positiveInt(body.rateMultiplierBps, 10000),
      creditUsdMicros,
    });
    return json({ ...result, creditUsdMicros });
  }

  if (url.pathname === "/api/ops/policy" && request.method === "PATCH") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const now = unix();
    let includedCreditsValue = nullableInt(body.includedCredits);
    if (body.autoCalculateCredits === true) {
      const current = await env.DB.prepare("SELECT * FROM commercial_policy WHERE customer_id=? LIMIT 1").bind(customerId).first<any>();
      if (!current) return json({ error: "commercial_policy_not_found" }, 404);
      const setting = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1").first<any>();
      const creditUsdMicros = Math.max(1, parseInt(String(JSON.parse(setting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10));
      includedCreditsValue = calculateCommercialPlan({
        monthlyAmountMinor: body.subscriptionAmountMinor === undefined ? Number(current.subscription_amount_minor) : positiveInt(body.subscriptionAmountMinor, 0),
        providerEnvelopeBps: body.providerEnvelopeBps === undefined ? Number(current.provider_envelope_bps) : positiveInt(body.providerEnvelopeBps, 0),
        operationsReserveBps: body.operationsReserveBps === undefined ? Number(current.operations_reserve_bps) : positiveInt(body.operationsReserveBps, 0),
        rateMultiplierBps: body.rateMultiplierBps === undefined ? Number(current.rate_multiplier_bps) : positiveInt(body.rateMultiplierBps, 10000),
        creditUsdMicros,
      }).includedCredits;
    }
    await env.DB.batch([
      env.DB.prepare(`UPDATE commercial_policy SET
        subscription_amount_minor=COALESCE(?,subscription_amount_minor),
        included_credits=COALESCE(?,included_credits),
        provider_envelope_bps=COALESCE(?,provider_envelope_bps),
        operations_reserve_bps=COALESCE(?,operations_reserve_bps),
        rate_multiplier_bps=COALESCE(?,rate_multiplier_bps),
        hard_stop_enabled=COALESCE(?,hard_stop_enabled),
        topup_enabled=COALESCE(?,topup_enabled),
        updated_at=? WHERE customer_id=?`)
        .bind(
          nullableInt(body.subscriptionAmountMinor), includedCreditsValue,
          nullableInt(body.providerEnvelopeBps), nullableInt(body.operationsReserveBps),
          nullableInt(body.rateMultiplierBps), nullableBoolInt(body.hardStopEnabled),
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
    return json({ ok: true, includedCredits: includedCreditsValue });
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
         mr.effective_at
       FROM model_routes r
       LEFT JOIN model_rates mr ON mr.id=(
         SELECT id FROM model_rates x WHERE x.alias=r.alias ORDER BY x.version DESC LIMIT 1
       )
       ORDER BY r.alias`,
    ).all();
    return json({ models: rows.results ?? [] });
  }

  if (url.pathname.startsWith("/api/ops/models/") && request.method === "PATCH") {
    const alias = decodeURIComponent(url.pathname.slice("/api/ops/models/".length));
    const current = await env.DB.prepare("SELECT * FROM model_routes WHERE alias=? LIMIT 1").bind(alias).first<any>();
    if (!current) return json({ error: "model_alias_not_found" }, 404);
    const body = await readJson(request);
    const now = unix();

    const provider = body.provider ?? current.provider;
    const providerConnectionId = body.providerConnectionId === undefined
      ? current.provider_connection_id
      : (body.providerConnectionId || null);
    const fallbackProvider = body.fallbackProvider ?? current.fallback_provider ?? null;
    const fallbackProviderConnectionId = body.fallbackProviderConnectionId === undefined
      ? current.fallback_provider_connection_id
      : (body.fallbackProviderConnectionId || null);
    if (!["workers-ai","mkety-managed"].includes(String(provider)) && !providerConnectionId) {
      return json({ error: "provider_connection_required" }, 400);
    }
    if (providerConnectionId) {
      const connection = await env.DB.prepare(
        "SELECT id,provider,status FROM provider_connections WHERE id=? LIMIT 1",
      ).bind(providerConnectionId).first<any>();
      if (!connection || connection.status !== "active" || connection.provider !== provider) {
        return json({ error: "provider_connection_mismatch" }, 400);
      }
    }
    if (fallbackProvider && !["workers-ai","mkety-managed"].includes(String(fallbackProvider)) && !fallbackProviderConnectionId) {
      return json({ error: "fallback_provider_connection_required" }, 400);
    }
    if (fallbackProviderConnectionId) {
      const connection = await env.DB.prepare(
        "SELECT id,provider,status FROM provider_connections WHERE id=? LIMIT 1",
      ).bind(fallbackProviderConnectionId).first<any>();
      if (!connection || connection.status !== "active" || connection.provider !== fallbackProvider) {
        return json({ error: "fallback_provider_connection_mismatch" }, 400);
      }
    }

    await env.DB.prepare(
      `UPDATE model_routes SET provider=COALESCE(?,provider),provider_model=COALESCE(?,provider_model),
       provider_connection_id=?,fallback_provider=?,fallback_model=?,fallback_provider_connection_id=?,
       status=COALESCE(?,status),updated_at=? WHERE alias=?`,
    ).bind(
      body.provider ?? null,
      body.providerModel ?? null,
      providerConnectionId,
      fallbackProvider,
      body.fallbackModel ?? current.fallback_model ?? null,
      fallbackProviderConnectionId,
      body.status ?? null,
      now,
      alias,
    ).run();

    const costFields = [
      "providerInputCostMicrosPerMillion","providerOutputCostMicrosPerMillion",
      "providerImageCostMicros","providerAudioCostMicrosPerMinute",
    ];
    const creditFields = ["inputCreditsPerMillion","outputCreditsPerMillion","imageCredits","audioCreditsPerMinute"];
    if (costFields.concat(creditFields).some((key) => body[key] !== undefined) || body.generateRate === true) {
      const previous = await env.DB.prepare(
        "SELECT * FROM model_rates WHERE alias=? ORDER BY version DESC LIMIT 1",
      ).bind(alias).first<any>();
      const latest = await env.DB.prepare("SELECT COALESCE(MAX(version),0) AS v FROM model_rates WHERE alias=?")
        .bind(alias).first<any>();
      const commercialSetting = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1").first<any>();
      const creditUsdMicros = Math.max(1, parseInt(String(JSON.parse(commercialSetting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10));

      const inputCost = positiveInt(body.providerInputCostMicrosPerMillion, previous?.provider_input_cost_micros_per_million || 0);
      const outputCost = positiveInt(body.providerOutputCostMicrosPerMillion, previous?.provider_output_cost_micros_per_million || 0);
      const imageCost = positiveInt(body.providerImageCostMicros, previous?.provider_image_cost_micros || 0);
      const audioCost = positiveInt(body.providerAudioCostMicrosPerMinute, previous?.provider_audio_cost_micros_per_minute || 0);
      const generated = body.generateRate === true;
      const inputCredits = generated ? costToBaseCredits(inputCost, creditUsdMicros) : positiveInt(body.inputCreditsPerMillion, previous?.input_credits_per_million || 0);
      const outputCredits = generated ? costToBaseCredits(outputCost, creditUsdMicros) : positiveInt(body.outputCreditsPerMillion, previous?.output_credits_per_million || 0);
      const imageCredits = generated ? costToBaseCredits(imageCost, creditUsdMicros) : positiveInt(body.imageCredits, previous?.image_credits || 0);
      const audioCredits = generated ? costToBaseCredits(audioCost, creditUsdMicros) : positiveInt(body.audioCreditsPerMinute, previous?.audio_credits_per_minute || 0);

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
    ).bind(id("aud"), "operator", "model.updated", "model_alias", alias, JSON.stringify({ alias, provider }), now).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/ops/providers" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id,name,provider,endpoint_url,extra_json,status,created_at,updated_at,1 AS has_key FROM provider_connections ORDER BY name",
    ).all();
    return json({ providers: rows.results ?? [] });
  }

  if (url.pathname === "/api/ops/providers" && request.method === "POST") {
    const body = await readJson(request);
    const provider = requiredString(body.provider, "provider");
    if (!["openai","anthropic","gemini","azure-openai","openai-compatible"].includes(provider)) {
      return json({ error: "unsupported_provider" }, 400);
    }
    const apiKey = requiredString(body.apiKey, "apiKey");
    const endpointUrl = body.endpointUrl ? String(body.endpointUrl).trim() : null;
    if (endpointUrl) {
      const parsed = new URL(endpointUrl);
      if (parsed.protocol !== "https:") return json({ error: "provider_endpoint_must_be_https" }, 400);
    }
    const providerId = id("prv");
    const now = unix();
    await env.DB.prepare(
      "INSERT INTO provider_connections (id,name,provider,endpoint_url,api_key_ciphertext,extra_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      providerId,
      requiredString(body.name, "name"),
      provider,
      endpointUrl,
      await protectStoredSecret(apiKey, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY),
      JSON.stringify(body.extra || {}),
      "active",
      now,
      now,
    ).run();
    await env.DB.prepare(
      "INSERT INTO audit_events (id,actor_type,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(id("aud"), "operator", "provider.created", "provider_connection", providerId, JSON.stringify({ provider }), now).run();
    return json({ id: providerId, provider }, 201);
  }

  if (url.pathname.startsWith("/api/ops/providers/") && request.method === "PATCH") {
    const providerId = decodeURIComponent(url.pathname.slice("/api/ops/providers/".length));
    const current = await env.DB.prepare("SELECT * FROM provider_connections WHERE id=? LIMIT 1").bind(providerId).first<any>();
    if (!current) return json({ error: "provider_not_found" }, 404);
    const body = await readJson(request);
    const endpointUrl = body.endpointUrl === undefined ? current.endpoint_url : (body.endpointUrl || null);
    if (endpointUrl) {
      const parsed = new URL(String(endpointUrl));
      if (parsed.protocol !== "https:") return json({ error: "provider_endpoint_must_be_https" }, 400);
    }
    const cipher = body.apiKey
      ? await protectStoredSecret(String(body.apiKey), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY)
      : current.api_key_ciphertext;
    await env.DB.prepare(
      "UPDATE provider_connections SET name=COALESCE(?,name),endpoint_url=?,api_key_ciphertext=?,extra_json=COALESCE(?,extra_json),status=COALESCE(?,status),updated_at=? WHERE id=?",
    ).bind(
      body.name ?? null,
      endpointUrl,
      cipher,
      body.extra === undefined ? null : JSON.stringify(body.extra),
      body.status ?? null,
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
    const local = await env.DB.prepare("SELECT provider_hostname_id FROM customer_domains WHERE hostname=? AND kind='custom' LIMIT 1")
      .bind(hostname).first<any>();
    if (!local?.provider_hostname_id) return json({ error: "domain_not_found" }, 404);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/custom_hostnames/${local.provider_hostname_id}`,
      { headers: { authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}` } },
    );
    const data: any = await response.json();
    if (!response.ok || !data.success) return json({ error: "cloudflare_lookup_failed", details: data.errors ?? [] }, 502);
    const status = data.result.status === "active" ? "active" : "pending";
    const sslStatus = data.result.ssl?.status ?? null;
    await env.DB.prepare("UPDATE customer_domains SET status=?,ssl_status=?,verified_at=CASE WHEN ?='active' THEN ? ELSE verified_at END WHERE hostname=?")
      .bind(status, sslStatus, status, unix(), hostname).run();
    return json({ hostname, status, sslStatus, cnameTarget: env.PORTAL_CNAME_TARGET });
  }

  return json({ error: "not_found" }, 404);
}

async function handleAuth(request: Request, env: Env, customer: CustomerContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(requiredString(body.email, "email"));
    const password = requiredString(body.password, "password");
    const row = await env.DB.prepare(
      `SELECT u.id,u.email,u.password_hash,u.password_salt,u.password_iterations,cu.role
       FROM users u JOIN customer_users cu ON cu.user_id=u.id
       WHERE cu.customer_id=? AND u.email=? AND u.status='active' LIMIT 1`,
    ).bind(customer.customerId, email).first<any>();
    if (!row?.password_hash || !row?.password_salt) return json({ error: "invalid_credentials" }, 401);
    const ok = await verifyPassword(password, row.password_salt, row.password_iterations, row.password_hash);
    if (!ok) return json({ error: "invalid_credentials" }, 401);
    return issueSession(env, customer.customerId, row.id, row.role, row.email);
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
    const passwordData = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE id=?")
        .bind(passwordData.hash, passwordData.salt, passwordData.iterations, now, row.user_id),
      env.DB.prepare("UPDATE setup_tokens SET consumed_at=? WHERE id=?").bind(now, row.id),
    ]);
    return issueSession(env, customer.customerId, row.user_id, row.role, row.email);
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = getSessionCookie(request, env);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
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
    const p = await hashPassword(newPassword);
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
    return json({ customer, session, user, features });
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
      "SELECT id,name,slug,status,model_alias,timezone,memory_enabled,monthly_credit_cap FROM assistants WHERE customer_id=? ORDER BY created_at DESC",
    ).bind(customer.customerId).all();
    return json({ assistants: rows.results ?? [] });
  }

  if (url.pathname === "/api/assistants" && request.method === "POST") {
    if (!["owner","admin"].includes(session.role)) return json({ error: "forbidden" }, 403);
    const policy = await env.DB.prepare("SELECT max_assistants FROM feature_policy WHERE customer_id=?")
      .bind(customer.customerId).first<any>();
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM assistants WHERE customer_id=?")
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
      env.DB.prepare("INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id("aud"), "customer_user", session.userId, customer.customerId, "assistant.created", "assistant", assistantId, now),
    ]);
    return json({ id: assistantId, name, slug, modelAlias }, 201);
  }

  if (url.pathname === "/api/usage" && request.method === "GET") {
    const account = await env.DB.prepare(
      "SELECT balance,lifetime_granted,lifetime_consumed,updated_at FROM credit_accounts WHERE customer_id=?",
    ).bind(customer.customerId).first();
    const policy = await env.DB.prepare(
      "SELECT currency,subscription_amount_minor,included_credits,topup_enabled FROM commercial_policy WHERE customer_id=?",
    ).bind(customer.customerId).first();
    return json({ credits: account, plan: policy });
  }

  const runtimeResponse = await handleRuntimeApi(request, env, customer, session);
  if (runtimeResponse) return runtimeResponse;

  return json({ error: "not_found" }, 404);
}

async function handlePaymentWebhook(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  const supplied = request.headers.get("x-mkety-signature") || "";
  const expected = await hmacHex(env.MKETY_ASSIST_PAYMENT_WEBHOOK_SECRET, raw);
  if (!constantTimeEqual(supplied, expected)) return json({ error: "invalid_signature" }, 401);
  const payload = JSON.parse(raw);
  const eventId = requiredString(payload.id, "id");
  const eventType = requiredString(payload.type, "type");
  const customerId = requiredString(payload.customerId, "customerId");
  const customer = await env.DB.prepare("SELECT id,status FROM customers WHERE id=? LIMIT 1").bind(customerId).first<any>();
  if (!customer) return json({ error: "unknown_customer" }, 404);
  const now = unix();

  try {
    await env.DB.prepare(
      "INSERT INTO payment_events (id,provider_event_id,customer_id,event_type,amount_minor,currency,payload_hash,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(id("pay"), eventId, customerId, eventType, Number(payload.amountMinor || 0), payload.currency || "USD", await sha256(raw), now).run();
  } catch {
    return json({ ok: true, duplicate: true });
  }

  if (eventType === "subscription.payment_succeeded") {
    const policy = await env.DB.prepare(
      "SELECT included_credits FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customerId).first<any>();
    const credits = positiveInt(policy?.included_credits, 0);
    if (credits > 0) await grantCredits(env.DB, customerId, credits, "subscription_grant", eventId, now);
    await env.DB.prepare(
      "UPDATE customers SET billing_status='current',grace_until=NULL,updated_at=? WHERE id=?",
    ).bind(now, customerId).run();
  } else if (eventType === "payment.succeeded" && payload.grantType === "topup") {
    // Mkety Payments confirms the paid order. The signed event carries the
    // Assist top-up metadata created for that checkout.
    const credits = positiveInt(payload.credits, 0);
    if (credits > 0) await grantCredits(env.DB, customerId, credits, "topup_grant", eventId, now);
  } else if (eventType === "subscription.payment_failed") {
    const policy = await env.DB.prepare(
      "SELECT grace_period_days FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customerId).first<any>();
    const graceDays = Math.max(0, positiveInt(policy?.grace_period_days, 3));
    await env.DB.prepare(
      "UPDATE customers SET billing_status='past_due',grace_until=?,updated_at=? WHERE id=?",
    ).bind(now + graceDays * 86400, now, customerId).run();
  }

  await env.DB.prepare("UPDATE payment_events SET processed_at=? WHERE provider_event_id=?").bind(now, eventId).run();
  return json({ ok: true });
}

async function grantCredits(
  db: D1Database,
  customerId: string,
  credits: number,
  kind: string,
  referenceId: string,
  now: number,
) {
  const account = await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind(customerId).first<any>();
  const next = Number(account?.balance || 0) + credits;
  await db.batch([
    db.prepare("UPDATE credit_accounts SET balance=?,lifetime_granted=lifetime_granted+?,updated_at=? WHERE customer_id=?")
      .bind(next, credits, now, customerId),
    db.prepare("INSERT INTO credit_ledger (id,customer_id,delta,kind,reference_id,balance_after,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id("led"), customerId, credits, kind, referenceId, next, now),
  ]);
}

async function createCustomHostname(env: Env, customerId: string, hostnameInput: string) {
  const hostname = normalizeHostname(hostnameInput);
  const now = unix();
  const headers = {
    authorization: `Bearer ${env.MKETY_ASSIST_CF_SAAS_TOKEN}`,
    "content-type": "application/json",
  };

  // Match the MkLMS SaaS-domain pattern: Custom Hostname + exact Worker route.
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
          custom_metadata: { customer_id: customerId, product: "mkety-assist" },
        }),
      },
    );
    const data: any = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(`Cloudflare custom hostname creation failed: ${JSON.stringify(data.errors || data)}`);
    }
    result = data.result;
  }

  const routePattern = `${hostname}/*`;
  const routesResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/workers/routes`,
    { headers },
  );
  const routesData: any = await routesResponse.json();
  if (!routesResponse.ok || !routesData.success) {
    throw new Error(`Cloudflare Worker route lookup failed: ${JSON.stringify(routesData.errors || routesData)}`);
  }
  const matchingRoutes = (routesData.result || []).filter((route: any) => route.pattern === routePattern);
  if (matchingRoutes.length > 1) throw new Error(`Multiple Worker routes exist for ${routePattern}`);
  if (matchingRoutes[0]?.script && matchingRoutes[0].script !== env.APP_WORKER_NAME) {
    throw new Error(`Worker route ${routePattern} belongs to ${matchingRoutes[0].script}, expected ${env.APP_WORKER_NAME}`);
  }
  if (!matchingRoutes.length) {
    const createRoute = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/workers/routes`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ pattern: routePattern, script: env.APP_WORKER_NAME }),
      },
    );
    const routeData: any = await createRoute.json();
    if (!createRoute.ok || !routeData.success) {
      throw new Error(`Cloudflare Worker route creation failed: ${JSON.stringify(routeData.errors || routeData)}`);
    }
  }

  const validation = {
    ownership_verification: result.ownership_verification ?? null,
    ssl_validation_records: result.ssl?.validation_records ?? null,
    cname_target: env.PORTAL_CNAME_TARGET,
    routing_origin: env.ROUTING_ORIGIN,
    worker_route: routePattern,
  };

  const existing = await env.DB.prepare("SELECT id FROM customer_domains WHERE hostname=? LIMIT 1").bind(hostname).first<any>();
  await env.DB.batch([
    env.DB.prepare("UPDATE customer_domains SET is_primary=0 WHERE customer_id=?").bind(customerId),
    existing
      ? env.DB.prepare(
          "UPDATE customer_domains SET customer_id=?,kind='custom',is_primary=1,status=?,ssl_status=?,provider_hostname_id=?,validation_json=?,verified_at=CASE WHEN ?='active' THEN ? ELSE verified_at END WHERE id=?",
        ).bind(customerId, result.status === "active" ? "active" : "pending", result.ssl?.status || null, result.id, JSON.stringify(validation), result.status, now, existing.id)
      : env.DB.prepare(
          "INSERT INTO customer_domains (id,customer_id,hostname,kind,is_primary,status,ssl_status,provider_hostname_id,validation_json,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).bind(id("dom"), customerId, hostname, "custom", 1, result.status === "active" ? "active" : "pending", result.ssl?.status || null, result.id, JSON.stringify(validation), now, result.status === "active" ? now : null),
  ]);

  return {
    hostname,
    status: result.status,
    sslStatus: result.ssl?.status ?? null,
    cnameTarget: env.PORTAL_CNAME_TARGET,
    routingOrigin: env.ROUTING_ORIGIN,
    workerRoute: routePattern,
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

async function requireSession(request: Request, env: Env, customerId: string): Promise<Session | null> {
  const token = getSessionCookie(request, env);
  if (!token) return null;
  const now = unix();
  const row = await env.DB.prepare(
    `SELECT s.user_id,s.customer_id,u.email,cu.role FROM sessions s
     JOIN users u ON u.id=s.user_id
     JOIN customer_users cu ON cu.user_id=s.user_id AND cu.customer_id=s.customer_id
     WHERE s.token_hash=? AND s.customer_id=? AND s.expires_at>? AND u.status='active' LIMIT 1`,
  ).bind(await sha256(token), customerId, now).first<any>();
  if (!row) return null;
  return { userId: row.user_id, customerId: row.customer_id, role: row.role, email: row.email };
}

async function issueSession(env: Env, customerId: string, userId: string, role: Session["role"], email: string): Promise<Response> {
  const token = randomToken(32);
  const now = unix();
  const ttl = Number(env.SESSION_TTL_SECONDS || "2592000");
  await env.DB.prepare(
    "INSERT INTO sessions (id,token_hash,user_id,customer_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(id("ses"), await sha256(token), userId, customerId, now + ttl, now, now).run();
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

async function hashPassword(password: string) {
  const iterations = 310000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt), iterations };
}

async function verifyPassword(password: string, saltHex: string, iterations: number, expectedHash: string) {
  const salt = hexToBytes(saltHex);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(iterations) }, key, 256);
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

function isOpsAuthorized(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.MKETY_ASSIST_OPS_TOKEN) && constantTimeEqual(token, env.MKETY_ASSIST_OPS_TOKEN);
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

function calculateCommercialPlan(input: {
  monthlyAmountMinor: number;
  providerEnvelopeBps: number;
  operationsReserveBps: number;
  rateMultiplierBps: number;
  creditUsdMicros: number;
}) {
  if (input.monthlyAmountMinor <= 0) throw new HttpError(400, "monthly_amount_must_be_positive");
  if (input.providerEnvelopeBps < 1 || input.providerEnvelopeBps > 10000) throw new HttpError(400, "provider_envelope_invalid");
  if (input.operationsReserveBps < 0 || input.operationsReserveBps >= 10000) throw new HttpError(400, "operations_reserve_invalid");
  if (input.rateMultiplierBps < 10000 || input.rateMultiplierBps > 100000) throw new HttpError(400, "rate_multiplier_invalid");
  const monthlyUsdMicros = input.monthlyAmountMinor * 10000;
  const providerEnvelopeUsdMicros = Math.floor(monthlyUsdMicros * input.providerEnvelopeBps / 10000);
  const usableProviderUsdMicros = Math.floor(providerEnvelopeUsdMicros * (10000 - input.operationsReserveBps) / 10000);
  const customerUsageValueUsdMicros = Math.floor(usableProviderUsdMicros * input.rateMultiplierBps / 10000);
  const includedCredits = Math.floor(customerUsageValueUsdMicros / Math.max(1, input.creditUsdMicros));
  return { providerEnvelopeUsdMicros, usableProviderUsdMicros, customerUsageValueUsdMicros, includedCredits };
}

function costToBaseCredits(providerCostMicros: number, creditUsdMicros: number) {
  if (providerCostMicros <= 0) return 0;
  return Math.ceil(providerCostMicros / Math.max(1, creditUsdMicros));
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

function setupPage(customer: CustomerContext, token: string) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Set up ${escapeHtml(customer.customerName)} AI</title>
<style>body{font:16px system-ui;margin:0;background:#0d0e14;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(440px,90vw);background:#171924;padding:28px;border-radius:18px}input,button{box-sizing:border-box;width:100%;padding:12px;margin:7px 0;border-radius:10px;border:1px solid #34384a;background:#10121a;color:#fff}button{background:#6d4aff;border:0;font-weight:700;cursor:pointer}.muted{color:#a8adbd;font-size:14px}</style></head>
<body><main class="card"><h1>Set up your portal</h1><p class="muted">${escapeHtml(customer.customerName)} AI</p><form id="setup"><input id="password" type="password" minlength="12" placeholder="Choose password (12+ characters)" required><button>Create access</button></form><p id="msg" class="muted"></p>
<script>const token=${JSON.stringify(token)};document.getElementById('setup').onsubmit=async(e)=>{e.preventDefault();const r=await fetch('/api/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password:password.value})});if(r.ok)location.href='/';else msg.textContent='This setup link is invalid or expired.';};</script></main></body></html>`);
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
