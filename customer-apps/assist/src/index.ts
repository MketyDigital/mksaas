/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleApiKeyInference, handleAssistantTelegramWebhook, handleRuntimeApi, processDueReminders, runtimeErrorResponse } from "./runtime";
import { finishOperatorOidc, startOperatorOidc } from "./operator-oidc";
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
  MKETY_ASSIST_CF_SAAS_TOKEN: string;
  FLUTTERWAVE_CHECKOUT_BROKER_SECRET?: string;
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

      if ((host === env.PORTAL_CNAME_TARGET || host === env.ROUTING_ORIGIN) && url.pathname === "/payment/return" && request.method === "GET") {
        return handlePaymentReturn(url, env);
      }

      const customer = await resolveCustomerByHost(env.DB, host, env.HOSTED_SUFFIX);
      if (!customer) return brandedNotFound(host);

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
    await processDueReminders(env);
  },
};

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
    const autoIncludedCredits = String(body.autoIncludedCredits ?? "yes") !== "no";
    let includedCredits = positiveInt(body.includedCredits, 0);
    if (autoIncludedCredits && monthlyPrice > 0) {
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
      env.DB.prepare("INSERT INTO customers (id,slug,name,status,billing_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
        .bind(customerId, slug, name, "active", "pending", now, now),
      env.DB.prepare("INSERT INTO customer_domains (id,customer_id,hostname,kind,is_primary,status,ssl_status,created_at,verified_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id("dom"), customerId, hostedHostname, "hosted", customHostname ? 0 : 1, "active", "active", now, now),
      env.DB.prepare("INSERT INTO users (id,email,status,created_at,updated_at) VALUES (?,?,?,?,?)")
        .bind(userId, adminEmail, "active", now, now),
      env.DB.prepare("INSERT INTO customer_users (customer_id,user_id,role,created_at) VALUES (?,?,?,?)")
        .bind(customerId, userId, "owner", now),
      env.DB.prepare("INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)")
        .bind(id("set"), customerId, userId, setupHash, now + 86400, now),
      env.DB.prepare("INSERT INTO credit_accounts (customer_id,balance,lifetime_granted,lifetime_consumed,updated_at) VALUES (?,?,?,?,?)")
        .bind(customerId, 0, 0, 0, now),
      env.DB.prepare("INSERT INTO commercial_policy (customer_id,subscription_amount_minor,included_credits,provider_envelope_bps,operations_reserve_bps,rate_multiplier_bps,funding_mode,minimum_funding_minor,setup_fee_minor,credit_rollover,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(customerId, monthlyPrice, includedCredits, providerEnvelopeBps, operationsReserveBps, rateMultiplierBps, fundingMode, minimumFundingMinor, setupFeeMinor, 1, now),
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

    const token = randomToken(32);
    const tokenHash = await sha256(token);
    await env.DB.batch([
      env.DB.prepare("UPDATE setup_tokens SET consumed_at=? WHERE customer_id=? AND consumed_at IS NULL")
        .bind(now, customerId),
      env.DB.prepare("INSERT INTO setup_tokens (id,customer_id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)")
        .bind(id("set"), customerId, row.user_id, tokenHash, now + 86400, now),
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
      "SELECT hostname,provider_hostname_id FROM customer_domains WHERE customer_id=? AND kind='custom'",
    ).bind(customerId).all<any>();
    for (const domain of domains.results ?? []) {
      await deleteCustomHostnameInfrastructure(env, String(domain.hostname), domain.provider_hostname_id ? String(domain.provider_hostname_id) : null);
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

  if (url.pathname === "/api/ops/credits" && request.method === "POST") {
    const body = await readJson(request);
    const customerId = requiredString(body.customerId, "customerId");
    const delta = parseInt(String(body.delta ?? "0"), 10);
    if (!Number.isFinite(delta) || delta === 0) return json({ error: "credit_delta_must_be_nonzero" }, 400);
    const reason = requiredString(body.reason, "reason").slice(0, 300);
    const account = await env.DB.prepare("SELECT balance FROM credit_accounts WHERE customer_id=? LIMIT 1").bind(customerId).first<any>();
    if (!account) return json({ error: "credit_account_not_found" }, 404);
    const next = parseInt(String(account.balance || 0), 10) + delta;
    if (next < 0) return json({ error: "credit_adjustment_would_go_negative" }, 409);
    const now = unix();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE credit_accounts SET balance=?,lifetime_granted=lifetime_granted+CASE WHEN ?>0 THEN ? ELSE 0 END,
         updated_at=? WHERE customer_id=?`,
      ).bind(next, delta, delta, now, customerId),
      env.DB.prepare(
        "INSERT INTO credit_ledger (id,customer_id,delta,kind,reference_id,balance_after,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(id("led"), customerId, delta, "operator_adjustment", null, next, JSON.stringify({ reason }), now),
      env.DB.prepare(
        "INSERT INTO audit_events (id,actor_type,customer_id,action,target_type,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(id("aud"), "operator", customerId, "credits.adjusted", "customer", customerId, JSON.stringify({ delta, reason, balanceAfter: next }), now),
    ]);
    return json({ ok: true, balance: next });
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
    const setting = await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1").first<any>();
    const creditUsdMicros = Math.max(1, parseInt(String(JSON.parse(setting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10));
    const result = calculateCommercialPlan({
      monthlyAmountMinor: parseUsdMinorValue(body.monthlyPriceUsd, "monthly price"),
      providerEnvelopeBps: parsePercentBpsValue(body.managedCostSharePercent, 15, 0.01, 100),
      operationsReserveBps: parsePercentBpsValue(body.operationsReservePercent, 10, 0, 99.99),
      rateMultiplierBps: parsePercentBpsValue(body.customerRateMultiplierPercent, 100, 100, 1000),
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
    if (!["openai","anthropic","gemini","vertex","cloudflare-ai","bedrock","azure-openai","openai-compatible"].includes(provider)) {
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
    const stored = await env.DB.prepare(
      "SELECT validation_json FROM customer_domains WHERE hostname=? AND kind='custom' LIMIT 1",
    ).bind(hostname).first<any>();
    return json({
      hostname,
      status,
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

  if (url.pathname === "/api/domains" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT hostname,kind,is_primary,status,ssl_status,validation_json,verified_at FROM customer_domains WHERE customer_id=? ORDER BY is_primary DESC,created_at ASC",
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
      })),
      cnameTarget: env.PORTAL_CNAME_TARGET,
    });
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

  if (url.pathname === "/api/billing/checkouts" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id,reference,provider,credits,canonical_amount_minor,canonical_currency,
              provider_amount_minor,provider_currency,status,created_at,settled_at
       FROM payment_checkouts WHERE customer_id=? ORDER BY created_at DESC LIMIT 50`,
    ).bind(customer.customerId).all();
    return json({ checkouts: rows.results ?? [] });
  }

  if (url.pathname === "/api/billing/topup/start" && request.method === "POST") {
    if (!env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET) return json({ error: "topup_provider_not_configured" }, 503);
    const policy = await env.DB.prepare(
      "SELECT topup_enabled,currency FROM commercial_policy WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    if (!policy?.topup_enabled) return json({ error: "topups_not_enabled" }, 403);

    const body = await readJson(request);
    const credits = positiveInt(body.credits, 0);
    if (credits < 100 || credits > 5_000_000) return json({ error: "invalid_topup_credits" }, 400);

    const setting = await env.DB.prepare(
      "SELECT value_json FROM system_settings WHERE key='commercial' LIMIT 1",
    ).first<any>();
    const creditUsdMicros = Math.max(
      1,
      parseInt(String(JSON.parse(setting?.value_json || '{"creditUsdMicros":1000}').creditUsdMicros || 1000), 10),
    );
    const canonicalAmountMinor = Math.max(1, Math.ceil((credits * creditUsdMicros) / 10_000));
    const checkoutId = id("chk");
    const reference = `ASSIST-MKA-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const now = unix();

    await env.DB.prepare(
      `INSERT INTO payment_checkouts
       (id,customer_id,user_id,reference,provider,credits,canonical_amount_minor,canonical_currency,status,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      checkoutId, customer.customerId, session.userId, reference, "flutterwave",
      credits, canonicalAmountMinor, "USD", "pending", now,
    ).run();

    const canonicalAmountUsd = (canonicalAmountMinor / 100).toFixed(2);
    const brokerResponse = await fetch("https://mkety.com/api/payments/flutterwave/start", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source: "assist",
        reference,
        canonical_amount_usd: canonicalAmountUsd,
        requested_payment_currency: String(body.paymentCurrency || "USD").toUpperCase(),
        email: session.email,
        customer_name: customer.customerName,
        checkout_id: checkoutId,
        redirect_url: `https://${env.PORTAL_CNAME_TARGET}/payment/return?reference=${encodeURIComponent(reference)}`,
        checkout_experience: "hosted",
      }),
    });
    const broker = await brokerResponse.json<any>();
    if (!brokerResponse.ok || !broker.success || !broker.checkout_url) {
      await env.DB.prepare("UPDATE payment_checkouts SET status='failed' WHERE id=? AND status='pending'")
        .bind(checkoutId).run();
      return json({ error: "topup_checkout_failed" }, 502);
    }

    await env.DB.prepare(
      "UPDATE payment_checkouts SET provider_amount_minor=?,provider_currency=? WHERE id=?",
    ).bind(
      parseInt(String(broker.provider_amount_minor || 0), 10) || null,
      broker.provider_currency || broker.checkout_currency || null,
      checkoutId,
    ).run();

    return json({
      checkoutId,
      reference,
      checkoutUrl: broker.checkout_url,
      credits,
      canonicalAmountMinor,
      canonicalCurrency: "USD",
      providerAmountMinor: broker.provider_amount_minor ?? null,
      providerCurrency: broker.provider_currency ?? broker.checkout_currency ?? null,
    }, 201);
  }

  const runtimeResponse = await handleRuntimeApi(request, env, customer, session);
  if (runtimeResponse) return runtimeResponse;

  return json({ error: "not_found" }, 404);
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

  const routesResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/workers/routes`,
    { headers },
  );
  const routesData: any = await routesResponse.json();
  if (!routesResponse.ok || !routesData.success) {
    throw new Error(`Cloudflare Worker route lookup failed during delete: ${JSON.stringify(routesData.errors || routesData)}`);
  }
  const routePattern = `${hostname}/*`;
  const routes = (routesData.result || []).filter((route: any) => route.pattern === routePattern);
  for (const route of routes) {
    if (route.script && route.script !== env.APP_WORKER_NAME) {
      throw new Error(`Refusing to delete route ${routePattern}; it belongs to ${route.script}`);
    }
    const del = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.MKETY_ASSIST_CF_ZONE_ID}/workers/routes/${route.id}`,
      { method: "DELETE", headers },
    );
    const data: any = await del.json();
    if (!del.ok || !data.success) {
      throw new Error(`Cloudflare Worker route delete failed: ${JSON.stringify(data.errors || data)}`);
    }
  }

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
