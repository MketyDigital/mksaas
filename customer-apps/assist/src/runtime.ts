import { pauseAssistant, pauseCustomer, resolveAutomationState, returnToAi, takeOverConversation } from "./handoff/service";
import { mayUseFallback } from "./providers/validation";
import { clampToolResponse, validateToolEndpoint } from "./security/outbound";
import { archiveAssistant, deleteAssistant, listAssistantVersions, recordAssistantVersion, restoreAssistant, rollbackAssistantVersion } from "./assistants/service";
/* eslint-disable @typescript-eslint/no-explicit-any */
type AiBinding = {
  run(model: string, input: unknown): Promise<any>;
  toMarkdown(
    files: { name: string; blob: Blob } | Array<{ name: string; blob: Blob }>,
    options?: unknown,
  ): Promise<any>;
};

type AssistEnv = {
  DB: D1Database;
  AI: AiBinding;
  MEDIA: R2Bucket;
  MKETY_ASSIST_SECRET_ENCRYPTION_KEY: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN: string;
  PORTAL_CNAME_TARGET: string;
};

type Customer = {
  customerId: string;
  customerName: string;
  customerSlug: string;
};

type Session = {
  userId: string;
  customerId: string;
  role: "owner" | "admin" | "member";
  email: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function handleRuntimeApi(
  request: Request,
  env: AssistEnv,
  customer: Customer,
  session: Session,
): Promise<Response | null> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/keys" && request.method === "GET") {
    requireAdmin(session);
    const rows = await env.DB.prepare(
      `SELECT k.id,k.name,k.token_prefix,k.status,k.assistant_id,k.created_at,k.last_used_at,k.expires_at,
              a.name AS assistant_name
       FROM customer_api_keys k
       LEFT JOIN assistants a ON a.id=k.assistant_id
       WHERE k.customer_id=?
       ORDER BY k.created_at DESC`,
    ).bind(customer.customerId).all();
    return json({ keys: rows.results ?? [] });
  }

  if (url.pathname === "/api/keys" && request.method === "POST") {
    requireAdmin(session);
    const body = await readJson(request);
    const name = required(body.name, "name").slice(0, 80);
    const assistantId = body.assistantId ? required(body.assistantId, "assistantId") : null;
    if (assistantId) await assertAssistant(env.DB, customer.customerId, assistantId);
    const raw = `mka_${randomToken(32)}`;
    const prefix = raw.slice(0, 12);
    const now = unix();
    const keyId = id("key");
    const expiresAt = body.expiresAt ? Math.floor(new Date(String(body.expiresAt)).getTime() / 1000) : null;
    if (expiresAt && (!Number.isFinite(expiresAt) || expiresAt <= now)) throw new ApiError(400, "invalid_expiry");
    await env.DB.prepare(
      "INSERT INTO customer_api_keys (id,customer_id,assistant_id,name,token_prefix,token_hash,status,created_by_user_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).bind(keyId, customer.customerId, assistantId, name, prefix, await sha256Text(raw), "active", session.userId, now, expiresAt).run();
    return json({ id: keyId, name, key: raw, prefix, assistantId, expiresAt }, 201);
  }

  if (parts[0] === "api" && parts[1] === "keys" && parts[2] && request.method === "DELETE") {
    requireAdmin(session);
    const keyId = parts[2];
    await env.DB.prepare(
      "UPDATE customer_api_keys SET status='revoked',revoked_at=? WHERE id=? AND customer_id=? AND status='active'",
    ).bind(unix(), keyId, customer.customerId).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/knowledge" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT kc.id,kc.name,COUNT(ki.id) AS items
       FROM knowledge_collections kc
       LEFT JOIN knowledge_items ki ON ki.collection_id=kc.id
       WHERE kc.customer_id=?
       GROUP BY kc.id,kc.name
       ORDER BY kc.updated_at DESC`,
    ).bind(customer.customerId).all();
    return json({ collections: rows.results ?? [] });
  }

  if (url.pathname === "/api/knowledge" && request.method === "POST") {
    requireAdmin(session);
    if (!(await customerFeatureEnabled(env.DB, customer.customerId, "knowledge_enabled"))) {
      return json({ error: "knowledge_not_enabled" }, 403);
    }
    const body = await readJson(request);
    const name = required(body.name, "name");
    const now = unix();
    const collectionId = id("knc");
    await env.DB.prepare(
      "INSERT INTO knowledge_collections (id,customer_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
    ).bind(collectionId, customer.customerId, name, now, now).run();
    return json({ id: collectionId, name }, 201);
  }

  if (url.pathname === "/api/knowledge/item" && request.method === "POST") {
    requireAdmin(session);
    if (!(await customerFeatureEnabled(env.DB, customer.customerId, "knowledge_enabled"))) {
      return json({ error: "knowledge_not_enabled" }, 403);
    }
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const collectionId = required(form.get("collectionId"), "collectionId");
      await assertCollection(env.DB, customer.customerId, collectionId);
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "file_required" }, 400);
      if (file.size > 10 * 1024 * 1024) return json({ error: "file_too_large" }, 413);
      const bytes = await file.arrayBuffer();
      const itemId = id("kni");
      const key = `knowledge/${customer.customerId}/${itemId}/${sanitizeFilename(file.name)}`;
      await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream" } });
      let textual = isTextMime(file.type, file.name) ? decoder.decode(bytes) : null;
      let conversionError: string | null = null;
      if (!textual) {
        try {
          const converted = await env.AI.toMarkdown(
            { name: file.name, blob: new Blob([bytes], { type: file.type || "application/octet-stream" }) },
            { conversionOptions: { output: { format: "text" }, pdf: { metadata: false } } },
          );
          const result = Array.isArray(converted) ? converted[0] : converted;
          if (result?.format === "error") conversionError = String(result.error || "conversion_failed");
          else if (typeof result?.data === "string" && result.data.trim()) textual = result.data.trim();
          else conversionError = "conversion_returned_no_text";
        } catch (error) {
          conversionError = error instanceof Error ? error.message : "conversion_failed";
        }
      }
      const now = unix();
      await env.DB.prepare(
        `INSERT INTO knowledge_items
         (id,customer_id,collection_id,r2_key,title,mime_type,status,content_text,metadata_json,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        itemId, customer.customerId, collectionId, key, file.name, file.type || null,
        textual ? "ready" : "stored", textual, JSON.stringify({ size: file.size, conversionError }), now, now,
      ).run();
      return json({
        id: itemId,
        title: file.name,
        status: textual ? "ready" : "stored",
        conversionError,
      }, 201);
    }

    const body = await readJson(request);
    const collectionId = required(body.collectionId, "collectionId");
    await assertCollection(env.DB, customer.customerId, collectionId);
    const title = required(body.title, "title");
    const content = required(body.content, "content");
    if (content.length > 250000) return json({ error: "knowledge_item_too_large" }, 413);
    const now = unix();
    const itemId = id("kni");
    await env.DB.prepare(
      `INSERT INTO knowledge_items
       (id,customer_id,collection_id,title,mime_type,status,content_text,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(itemId, customer.customerId, collectionId, title, "text/plain", "ready", content, now, now).run();
    return json({ id: itemId, title, status: "ready" }, 201);
  }

  if (url.pathname === "/api/conversations" && request.method === "GET") {
    const assistantId = url.searchParams.get("assistantId");
    const query = assistantId
      ? env.DB.prepare(
          `SELECT c.id,c.assistant_id,a.name AS assistant_name,c.channel,c.external_conversation_id,c.status,c.updated_at,
             (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
           FROM conversations c JOIN assistants a ON a.id=c.assistant_id
           WHERE c.customer_id=? AND c.assistant_id=? ORDER BY c.updated_at DESC LIMIT 100`,
        ).bind(customer.customerId, assistantId)
      : env.DB.prepare(
          `SELECT c.id,c.assistant_id,a.name AS assistant_name,c.channel,c.external_conversation_id,c.status,c.updated_at,
             (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
           FROM conversations c JOIN assistants a ON a.id=c.assistant_id
           WHERE c.customer_id=? ORDER BY c.updated_at DESC LIMIT 100`,
        ).bind(customer.customerId);
    const rows = await query.all();
    return json({ conversations: rows.results ?? [] });
  }

  if (parts[0] === "api" && parts[1] === "conversations" && parts[2] && parts[3] === "messages" && request.method === "GET") {
    const conversationId = parts[2];
    await assertConversation(env.DB, customer.customerId, conversationId);
    const rows = await env.DB.prepare(
      "SELECT id,role,content,media_json,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 300",
    ).bind(conversationId).all();
    return json({ messages: rows.results ?? [] });
  }

  if (url.pathname === "/api/automation" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT automation_paused FROM customers WHERE id=? LIMIT 1")
      .bind(customer.customerId).first<any>();
    return json({ paused: Boolean(row?.automation_paused) });
  }

  if (url.pathname === "/api/automation" && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    await pauseCustomer(env.DB, customer.customerId, Boolean(body.paused));
    return json({ ok: true, paused: Boolean(body.paused) });
  }

  if (parts[0] === "api" && parts[1] === "assistants" && parts[2] && parts[3] === "automation" && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    await pauseAssistant(env.DB, customer.customerId, parts[2], Boolean(body.paused));
    return json({ ok: true, paused: Boolean(body.paused) });
  }

  if (parts[0] === "api" && parts[1] === "conversations" && parts[2] && parts[3] === "automation" && request.method === "PATCH") {
    requireAdmin(session);
    const conversation = await env.DB.prepare(
      "SELECT assistant_id FROM conversations WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2], customer.customerId).first<any>();
    if (!conversation) return json({ error: "conversation_not_found" }, 404);
    const body = await readJson(request);
    if (body.paused === false) {
      await returnToAi(env.DB, customer.customerId, conversation.assistant_id, parts[2]);
    } else {
      await takeOverConversation(env.DB, customer.customerId, conversation.assistant_id, parts[2], session.userId);
    }
    return json({ ok: true, paused: body.paused !== false });
  }

  if (url.pathname === "/api/reminders" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT r.id,r.assistant_id,a.name AS assistant_name,r.conversation_id,r.due_at,r.payload_json,r.status,r.created_at,r.delivered_at
       FROM reminders r JOIN assistants a ON a.id=r.assistant_id
       WHERE r.customer_id=? ORDER BY r.due_at ASC LIMIT 200`,
    ).bind(customer.customerId).all();
    return json({ reminders: rows.results ?? [] });
  }

  if (url.pathname === "/api/reminders" && request.method === "POST") {
    requireAdmin(session);
    if (!(await customerFeatureEnabled(env.DB, customer.customerId, "reminders_enabled"))) {
      return json({ error: "reminders_not_enabled" }, 403);
    }
    const body = await readJson(request);
    const assistantId = required(body.assistantId, "assistantId");
    await assertAssistant(env.DB, customer.customerId, assistantId);
    const dueAt = Math.floor(new Date(required(body.dueAt, "dueAt")).getTime() / 1000);
    if (!Number.isFinite(dueAt) || dueAt <= unix()) return json({ error: "invalid_due_at" }, 400);
    const conversationId = body.conversationId ? required(body.conversationId, "conversationId") : null;
    if (conversationId) {
      const conversation = await env.DB.prepare(
        "SELECT id,reminders_opt_out FROM conversations WHERE id=? AND customer_id=? AND assistant_id=? LIMIT 1",
      ).bind(conversationId, customer.customerId, assistantId).first();
      if (!conversation) return json({ error: "conversation_not_found" }, 404);
      if (Number((conversation as any).reminders_opt_out || 0)) return json({ error: "conversation_reminders_opted_out" }, 409);
    }
    const reminderId = id("rem");
    const policy = await env.DB.prepare(
      "SELECT max_attempts FROM reminder_policies WHERE assistant_id=? AND customer_id=? LIMIT 1",
    ).bind(assistantId, customer.customerId).first<any>();
    await env.DB.prepare(
      "INSERT INTO reminders (id,customer_id,assistant_id,conversation_id,due_at,payload_json,status,created_at,max_attempts,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      reminderId, customer.customerId, assistantId, conversationId, dueAt,
      JSON.stringify({ text: required(body.text, "text") }), "scheduled", unix(),
      Math.max(1, Number(policy?.max_attempts || 3)),
      body.idempotencyKey ? String(body.idempotencyKey).slice(0, 160) : null,
    ).run();
    return json({ id: reminderId, dueAt }, 201);
  }

  if (parts[0] === "api" && parts[1] === "reminders" && parts[2] && request.method === "DELETE") {
    requireAdmin(session);
    const result = await env.DB.prepare(
      "UPDATE reminders SET status='cancelled' WHERE id=? AND customer_id=? AND status='scheduled'",
    ).bind(parts[2], customer.customerId).run();
    return json({ ok: Boolean(result.meta.changes) });
  }

  if (url.pathname === "/api/handoffs" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT h.id,h.assistant_id,a.name AS assistant_name,h.conversation_id,h.status,h.reason,h.created_at,h.resolved_at,
              c.external_conversation_id
       FROM human_handoffs h
       JOIN assistants a ON a.id=h.assistant_id
       JOIN conversations c ON c.id=h.conversation_id
       WHERE h.customer_id=? ORDER BY h.created_at DESC LIMIT 200`,
    ).bind(customer.customerId).all();
    return json({ handoffs: rows.results ?? [] });
  }

  if (parts[0] === "api" && parts[1] === "handoffs" && parts[2] && parts[3] === "reply" && request.method === "POST") {
    requireAdmin(session);
    const handoff = await env.DB.prepare(
      `SELECT h.id,h.assistant_id,h.conversation_id,c.external_conversation_id
       FROM human_handoffs h JOIN conversations c ON c.id=h.conversation_id
       WHERE h.id=? AND h.customer_id=? AND h.status='open' LIMIT 1`,
    ).bind(parts[2], customer.customerId).first<any>();
    if (!handoff) return json({ error: "handoff_not_found" }, 404);
    const body = await readJson(request);
    const text = required(body.text, "text");
    const token = await getAssistantSecret(env, handoff.assistant_id, "telegram_bot_token");
    if (!token) return json({ error: "telegram_not_connected" }, 409);
    const sent = await telegramSend(token, handoff.external_conversation_id, text);
    if (!sent.ok) return json({ error: "telegram_send_failed" }, 502);
    await env.DB.prepare(
      "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(id("msg"), customer.customerId, handoff.assistant_id, handoff.conversation_id, "human", text, unix()).run();
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "handoffs" && parts[2] && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    const status = String(body.status || "");
    if (!["open", "resolved"].includes(status)) return json({ error: "invalid_status" }, 400);
    await env.DB.prepare(
      "UPDATE human_handoffs SET status=?,resolved_at=? WHERE id=? AND customer_id=?",
    ).bind(status, status === "resolved" ? unix() : null, parts[2], customer.customerId).run();
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "assistants" && parts[2]) {
    const assistantId = parts[2];
    await assertAssistant(env.DB, customer.customerId, assistantId);

    if (parts.length === 3 && request.method === "GET") {
      const assistant = await env.DB.prepare(
        `SELECT a.*,
          (SELECT instructions FROM assistant_prompt_versions p WHERE p.assistant_id=a.id AND p.status='published' ORDER BY p.version DESC LIMIT 1) AS instructions,
          (SELECT config_json FROM assistant_channels ch WHERE ch.assistant_id=a.id AND ch.channel='telegram' LIMIT 1) AS telegram_config,
          (SELECT status FROM assistant_channels ch WHERE ch.assistant_id=a.id AND ch.channel='telegram' LIMIT 1) AS telegram_status
         FROM assistants a WHERE a.id=? AND a.customer_id=? LIMIT 1`,
      ).bind(assistantId, customer.customerId).first<any>();
      const collections = await env.DB.prepare(
        `SELECT kc.id,kc.name FROM assistant_knowledge ak JOIN knowledge_collections kc ON kc.id=ak.collection_id
         WHERE ak.assistant_id=?`,
      ).bind(assistantId).all();
      const tools = await env.DB.prepare(
        "SELECT id,name,description,endpoint_url,status FROM assistant_tools WHERE assistant_id=? ORDER BY name",
      ).bind(assistantId).all();
      return json({ assistant, knowledge: collections.results ?? [], tools: tools.results ?? [] });
    }

    if (parts.length === 3 && request.method === "PATCH") {
      requireAdmin(session);
      const body = await readJson(request);
      const allowedModels = await env.DB.prepare("SELECT 1 FROM model_routes WHERE alias=? AND status='active' LIMIT 1")
        .bind(body.modelAlias || "mkety-smart").first();
      if (body.modelAlias && !allowedModels) return json({ error: "model_alias_unavailable" }, 400);
      const now = unix();
      await env.DB.prepare(
        `UPDATE assistants SET name=COALESCE(?,name),status=COALESCE(?,status),model_alias=COALESCE(?,model_alias),
         timezone=COALESCE(?,timezone),memory_enabled=COALESCE(?,memory_enabled),monthly_credit_cap=COALESCE(?,monthly_credit_cap),updated_at=?
         WHERE id=? AND customer_id=?`,
      ).bind(
        body.name ?? null,
        ["active","paused","disabled"].includes(body.status) ? body.status : null,
        body.modelAlias ?? null,
        body.timezone ?? null,
        typeof body.memoryEnabled === "boolean" ? (body.memoryEnabled ? 1 : 0) : null,
        body.monthlyCreditCap === undefined ? null : parseFloat(String(body.monthlyCreditCap)),
        now, assistantId, customer.customerId,
      ).run();
      if (typeof body.instructions === "string") {
        const current = await env.DB.prepare("SELECT COALESCE(MAX(version),0) AS v FROM assistant_prompt_versions WHERE assistant_id=?")
          .bind(assistantId).first<any>();
        await env.DB.batch([
          env.DB.prepare("UPDATE assistant_prompt_versions SET status='archived' WHERE assistant_id=? AND status='published'").bind(assistantId),
          env.DB.prepare(
            "INSERT INTO assistant_prompt_versions (id,customer_id,assistant_id,version,instructions,status,created_at,published_at) VALUES (?,?,?,?,?,?,?,?)",
          ).bind(id("prm"), customer.customerId, assistantId, parseInt(String(current?.v || 0), 10) + 1, body.instructions, "published", now, now),
        ]);
      }
      await recordAssistantVersion(env.DB, customer.customerId, assistantId, session.userId);
      return json({ ok: true });
    }

    if (parts[3] === "versions" && request.method === "GET") {
      return json({ versions: await listAssistantVersions(env.DB, customer.customerId, assistantId) });
    }

    if (parts[3] === "rollback" && request.method === "POST") {
      requireAdmin(session);
      const body = await readJson(request);
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1) return json({ error: "invalid_version" }, 400);
      const newVersion = await rollbackAssistantVersion(env.DB, customer.customerId, assistantId, version, session.userId);
      return json({ ok: true, version: newVersion });
    }

    if (parts[3] === "archive" && request.method === "POST") {
      requireAdmin(session);
      await archiveAssistant(env.DB, customer.customerId, assistantId);
      return json({ ok: true });
    }

    if (parts[3] === "restore" && request.method === "POST") {
      requireAdmin(session);
      await restoreAssistant(env.DB, customer.customerId, assistantId);
      return json({ ok: true });
    }

    if (parts.length === 3 && request.method === "DELETE") {
      requireAdmin(session);
      try {
        await deleteAssistant(env.DB, customer.customerId, assistantId);
        return json({ ok: true });
      } catch (error) {
        const code = error instanceof Error ? error.message : "assistant_delete_failed";
        return json({ error: code }, code === "assistant_not_found" ? 404 : 409);
      }
    }

    if (parts[3] === "telegram" && request.method === "POST") {
      requireAdmin(session);
      const feature = await env.DB.prepare("SELECT telegram_enabled FROM feature_policy WHERE customer_id=?")
        .bind(customer.customerId).first<any>();
      if (!feature?.telegram_enabled) return json({ error: "telegram_not_enabled" }, 403);
      const body = await readJson(request);
      const botToken = required(body.botToken, "botToken");
      const me = await telegramGetMe(botToken);
      if (!me.ok || !me.result?.id) return json({ error: "invalid_telegram_bot_token" }, 400);
      const webhookSecret = randomToken(24);
      const encryptedToken = await protectSecret(botToken, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
      const encryptedWebhookSecret = await protectSecret(webhookSecret, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
      const now = unix();
      const webhookUrl = `https://${env.PORTAL_CNAME_TARGET}/api/telegram/${assistantId}`;
      const webhook = await telegramSetWebhook(botToken, webhookUrl, webhookSecret);
      if (!webhook.ok) return json({ error: "telegram_webhook_registration_failed", details: webhook.description || null }, 502);
      await env.DB.batch([
        upsertSecret(env.DB, customer.customerId, assistantId, "telegram_bot_token", encryptedToken, now),
        upsertSecret(env.DB, customer.customerId, assistantId, "telegram_webhook_secret", encryptedWebhookSecret, now),
        env.DB.prepare(
          `INSERT INTO assistant_channels (id,customer_id,assistant_id,channel,external_id,status,config_json,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(assistant_id,channel) DO UPDATE SET external_id=excluded.external_id,status='active',config_json=excluded.config_json,updated_at=excluded.updated_at`,
        ).bind(
          id("chn"), customer.customerId, assistantId, "telegram", String(me.result.id), "active",
          JSON.stringify({ username: me.result.username || null, firstName: me.result.first_name || null, webhookUrl }), now, now,
        ),
      ]);
      return json({ ok: true, bot: { id: me.result.id, username: me.result.username, name: me.result.first_name }, webhookUrl });
    }

    if (parts[3] === "telegram" && request.method === "DELETE") {
      requireAdmin(session);
      const token = await getAssistantSecret(env, assistantId, "telegram_bot_token");
      if (token) await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`, { method: "POST" });
      await env.DB.batch([
        env.DB.prepare("DELETE FROM assistant_secrets WHERE assistant_id=? AND name IN ('telegram_bot_token','telegram_webhook_secret')").bind(assistantId),
        env.DB.prepare("UPDATE assistant_channels SET status='disabled',updated_at=? WHERE assistant_id=? AND channel='telegram'").bind(unix(), assistantId),
      ]);
      return json({ ok: true });
    }

    if (parts[3] === "knowledge" && request.method === "PUT") {
      requireAdmin(session);
      if (!(await customerFeatureEnabled(env.DB, customer.customerId, "knowledge_enabled"))) {
        return json({ error: "knowledge_not_enabled" }, 403);
      }
      const body = await readJson(request);
      const ids = Array.isArray(body.collectionIds) ? body.collectionIds.map(String) : [];
      for (const collectionId of ids) await assertCollection(env.DB, customer.customerId, collectionId);
      const stmts = [env.DB.prepare("DELETE FROM assistant_knowledge WHERE assistant_id=?").bind(assistantId)];
      for (const collectionId of ids) {
        stmts.push(env.DB.prepare("INSERT INTO assistant_knowledge (assistant_id,collection_id) VALUES (?,?)").bind(assistantId, collectionId));
      }
      await env.DB.batch(stmts);
      return json({ ok: true });
    }

    if (parts[3] === "tools" && request.method === "POST") {
      requireAdmin(session);
      if (!(await customerFeatureEnabled(env.DB, customer.customerId, "tools_enabled"))) {
        return json({ error: "tools_not_enabled" }, 403);
      }
      const body = await readJson(request);
      const endpoint = required(body.endpointUrl, "endpointUrl");
      try { validateToolEndpoint(endpoint); } catch { return json({ error: "unsafe_tool_endpoint" }, 400); }
      const now = unix();
      const toolId = id("tool");
      const authCipher = body.authHeader ? await protectSecret(String(body.authHeader), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY) : null;
      await env.DB.prepare(
        "INSERT INTO assistant_tools (id,customer_id,assistant_id,name,description,endpoint_url,auth_header_ciphertext,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).bind(toolId, customer.customerId, assistantId, required(body.name, "name"), String(body.description || ""), endpoint, authCipher, "active", now, now).run();
      return json({ id: toolId }, 201);
    }

    if (parts[3] === "tools" && parts[4] && request.method === "DELETE") {
      requireAdmin(session);
      await env.DB.prepare("DELETE FROM assistant_tools WHERE id=? AND assistant_id=? AND customer_id=?")
        .bind(parts[4], assistantId, customer.customerId).run();
      return json({ ok: true });
    }
  }

  return null;
}

export async function handleAssistantTelegramWebhook(request: Request, env: AssistEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/telegram\/([^/]+)$/);
  if (!match || request.method !== "POST") return null;
  const assistantId = match[1];

  const assistant = await env.DB.prepare(
    `SELECT a.*,c.name AS customer_name,fp.vision_enabled,fp.voice_enabled,fp.knowledge_enabled,fp.human_handoff_enabled,fp.tools_enabled
     FROM assistants a
     JOIN customers c ON c.id=a.customer_id
     JOIN feature_policy fp ON fp.customer_id=a.customer_id
     WHERE a.id=? AND a.status='active' AND c.status='active' LIMIT 1`,
  ).bind(assistantId).first<any>();
  if (!assistant) return json({ ok: true });

  const webhookSecret = await getAssistantSecret(env, assistantId, "telegram_webhook_secret");
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!webhookSecret || !constantTimeEqual(supplied, webhookSecret)) return json({ error: "not_found" }, 404);

  const update = await readJson(request);
  const updateId = String(update.update_id ?? "");
  if (!updateId) return json({ ok: true });

  try {
    await env.DB.prepare(
      "INSERT INTO webhook_events (id,source,external_event_id,status,received_at) VALUES (?,?,?,?,?)",
    ).bind(id("wh"), `telegram:${assistantId}`, updateId, "received", unix()).run();
  } catch {
    return json({ ok: true, duplicate: true });
  }

  const message = update.message ?? update.edited_message;
  if (!message?.chat?.id || !message?.message_id) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const senderId = String(message.from?.id ?? message.chat.id);
  const providerMessageId = String(message.message_id);
  const token = await getAssistantSecret(env, assistantId, "telegram_bot_token");
  if (!token) {
    await markWebhook(env.DB, assistantId, updateId, "error");
    return json({ ok: true });
  }

  const messageText = typeof message.text === "string" ? message.text.trim() : "";
  if (messageText.startsWith("/start link_")) {
    const linkToken = messageText.slice("/start link_".length).split(/\s+/)[0];
    const challenge = await env.DB.prepare(
      `SELECT id,user_id FROM telegram_link_challenges
       WHERE token_hash=? AND assistant_id=? AND consumed_at IS NULL AND expires_at>? LIMIT 1`,
    ).bind(await sha256Text(linkToken), assistantId, unix()).first<any>();
    if (!challenge) {
      await telegramSend(token, chatId, "This Mkety Assist recovery-link request has expired. Return to your portal and start again.");
      await markWebhook(env.DB, assistantId, updateId, "processed");
      return json({ ok: true });
    }
    try {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE users SET telegram_user_id=?,telegram_username=?,telegram_recovery_assistant_id=?,telegram_linked_at=?,updated_at=? WHERE id=?",
        ).bind(String(message.from?.id ?? message.chat.id), message.from?.username ? String(message.from.username) : null, assistantId, unix(), unix(), challenge.user_id),
        env.DB.prepare("UPDATE telegram_link_challenges SET consumed_at=? WHERE id=?").bind(unix(), challenge.id),
      ]);
      await telegramSend(token, chatId, "Telegram is now connected to your Mkety Assist account for secure access recovery.");
    } catch {
      await telegramSend(token, chatId, "This Telegram account is already linked to another Mkety Assist user. Contact your administrator if this is unexpected.");
    }
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, recoveryLinked: true });
  }

  const conversation = await upsertConversation(env.DB, assistant.customer_id, assistantId, chatId);
  const inbound = await normalizeTelegramMessage(message, token, assistant, env, conversation.id);

  if (!inbound.text && !inbound.mediaContext) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true });
  }

  await env.DB.prepare(
    "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,media_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(
    id("msg"), assistant.customer_id, assistantId, conversation.id, "user",
    inbound.text || inbound.mediaContext || "", inbound.mediaJson ? JSON.stringify(inbound.mediaJson) : null, unix(),
  ).run();

  const reminderCommand = inbound.text.trim().toLowerCase();
  if (["stop reminders","cancel reminders","unsubscribe reminders"].includes(reminderCommand)) {
    await env.DB.batch([
      env.DB.prepare("UPDATE conversations SET reminders_opt_out=1,updated_at=? WHERE id=? AND customer_id=? AND assistant_id=?")
        .bind(unix(), conversation.id, assistant.customer_id, assistantId),
      env.DB.prepare("UPDATE reminders SET status='cancelled',cancelled_at=? WHERE conversation_id=? AND customer_id=? AND assistant_id=? AND status='scheduled'")
        .bind(unix(), conversation.id, assistant.customer_id, assistantId),
    ]);
    await telegramSend(token, chatId, "Reminders are off for this conversation. Send “resume reminders” if you want them again.");
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, remindersOptedOut: true });
  }
  if (reminderCommand === "resume reminders") {
    await env.DB.prepare(
      "UPDATE conversations SET reminders_opt_out=0,updated_at=? WHERE id=? AND customer_id=? AND assistant_id=?",
    ).bind(unix(), conversation.id, assistant.customer_id, assistantId).run();
    await telegramSend(token, chatId, "Reminders are enabled again for this conversation.");
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, remindersOptedOut: false });
  }

  if (assistant.human_handoff_enabled && shouldRequestHuman(inbound.text)) {
    await openHandoff(env.DB, assistant.customer_id, assistantId, conversation.id, inbound.text);
    await telegramSend(token, chatId, "I’ve handed this conversation to a human team member. They can reply here when available.");
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, handoff: true });
  }

  const existingHandoff = await env.DB.prepare(
    "SELECT id FROM human_handoffs WHERE conversation_id=? AND status='open' LIMIT 1",
  ).bind(conversation.id).first();
  if (existingHandoff) {
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, awaitingHuman: true });
  }

  const automation = await resolveAutomationState(env.DB, assistant.customer_id, assistantId, conversation.id);
  if (automation.paused) {
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, automationPaused: true, pauseScope: automation.reason });
  }

  const typing = telegramAction(token, chatId, "typing");
  void typing;

  const response = await runAssistant({
    env,
    assistant,
    conversationId: conversation.id,
    userText: inbound.text || "",
    mediaContext: inbound.mediaContext || "",
    imageCount: inbound.imageCount,
    audioSeconds: inbound.audioSeconds,
    senderId,
    providerMessageId,
  });

  if (!response.ok) {
    await telegramSend(token, chatId, response.userMessage);
    await markWebhook(env.DB, assistantId, updateId, "error");
    return json({ ok: true });
  }

  await env.DB.prepare(
    "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(id("msg"), assistant.customer_id, assistantId, conversation.id, "assistant", response.text, unix()).run();
  await env.DB.prepare("UPDATE conversations SET updated_at=? WHERE id=?").bind(unix(), conversation.id).run();
  await telegramSend(token, chatId, response.text);
  await markWebhook(env.DB, assistantId, updateId, "processed");
  return json({ ok: true });
}

export async function processDueReminders(env: AssistEnv): Promise<void> {
  const now = unix();
  const rows = await env.DB.prepare(
    `SELECT r.id,r.customer_id,r.assistant_id,r.conversation_id,r.payload_json,r.attempts,r.max_attempts,
            c.external_conversation_id,c.reminders_opt_out,
            COALESCE(p.enabled,1) AS policy_enabled,COALESCE(p.timezone,'UTC') AS policy_timezone,
            p.quiet_start_hour,p.quiet_end_hour
     FROM reminders r
     LEFT JOIN conversations c ON c.id=r.conversation_id AND c.customer_id=r.customer_id AND c.assistant_id=r.assistant_id
     LEFT JOIN reminder_policies p ON p.assistant_id=r.assistant_id AND p.customer_id=r.customer_id
     WHERE r.status='scheduled' AND r.due_at<=?
     ORDER BY r.due_at ASC LIMIT 100`,
  ).bind(now).all<any>();

  for (const reminder of rows.results ?? []) {
    try {
      if (Number(reminder.reminders_opt_out || 0)) {
        await env.DB.prepare(
          "UPDATE reminders SET status='cancelled',cancelled_at=?,last_error='recipient_opted_out' WHERE id=? AND customer_id=? AND status='scheduled'",
        ).bind(now, reminder.id, reminder.customer_id).run();
        continue;
      }
      if (!Number(reminder.policy_enabled ?? 1)) {
        await env.DB.prepare(
          "UPDATE reminders SET status='cancelled',cancelled_at=?,last_error='reminder_policy_disabled' WHERE id=? AND customer_id=? AND status='scheduled'",
        ).bind(now, reminder.id, reminder.customer_id).run();
        continue;
      }
      if (isQuietHour(now, String(reminder.policy_timezone || "UTC"), reminder.quiet_start_hour, reminder.quiet_end_hour)) {
        await env.DB.prepare(
          "UPDATE reminders SET due_at=?,last_error='quiet_hours' WHERE id=? AND customer_id=? AND status='scheduled'",
        ).bind(now + 3600, reminder.id, reminder.customer_id).run();
        continue;
      }
      const payload = JSON.parse(reminder.payload_json || "{}");
      const chatId = reminder.external_conversation_id;
      if (!chatId) throw new Error("reminder_has_no_conversation_destination");
      const automation = await resolveAutomationState(env.DB, reminder.customer_id, reminder.assistant_id, reminder.conversation_id);
      if (automation.paused) {
        await env.DB.prepare(
          "UPDATE reminders SET due_at=?,last_error=? WHERE id=? AND customer_id=? AND status='scheduled'",
        ).bind(now + 300, "automation_paused:" + String(automation.reason || "unknown"), reminder.id, reminder.customer_id).run();
        continue;
      }
      const token = await getAssistantSecret(env, reminder.assistant_id, "telegram_bot_token");
      if (!token) throw new Error("assistant_telegram_token_unavailable");
      const sent = await telegramSend(token, String(chatId), String(payload.text || "Reminder"));
      if (!sent.ok) throw new Error(sent.description || "telegram_send_failed");
      await env.DB.prepare(
        "UPDATE reminders SET status='delivered',delivered_at=?,last_error=NULL WHERE id=? AND customer_id=? AND status='scheduled'",
      ).bind(now, reminder.id, reminder.customer_id).run();
    } catch (error) {
      const attempts = Number(reminder.attempts || 0) + 1;
      const maxAttempts = Math.max(1, Number(reminder.max_attempts || 3));
      const terminal = attempts >= maxAttempts;
      const retryAt = now + Math.min(3600, Math.max(60, 60 * (2 ** Math.min(attempts - 1, 5))));
      await env.DB.prepare(
        "UPDATE reminders SET attempts=?,last_error=?,status=?,due_at=? WHERE id=? AND customer_id=? AND status='scheduled'",
      ).bind(
        attempts,
        String(error instanceof Error ? error.message : error).slice(0, 500),
        terminal ? "failed" : "scheduled",
        terminal ? reminder.due_at : retryAt,
        reminder.id,
        reminder.customer_id,
      ).run();
    }
  }
}

function isQuietHour(nowUnix: number, timezone: string, startValue: unknown, endValue: unknown) {
  const start = startValue == null ? null : Number(startValue);
  const end = endValue == null ? null : Number(endValue);
  if (start == null || end == null || !Number.isInteger(start) || !Number.isInteger(end)) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(nowUnix * 1000));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    if (hour < 0) return false;
    return start === end ? true : start < end ? hour >= start && hour < end : hour >= start || hour < end;
  } catch {
    return false;
  }
}

async function runAssistant(input: {
  env: AssistEnv;
  assistant: any;
  conversationId: string;
  userText: string;
  mediaContext: string;
  imageCount: number;
  audioSeconds: number;
  senderId: string;
  providerMessageId: string;
}) {
  const { env, assistant, conversationId } = input;
  const automation = await resolveAutomationState(env.DB, assistant.customer_id, assistant.id, conversationId);
  if (automation.paused) return { ok: false as const, paused: true as const, userMessage: "Automation is paused for this conversation." };

  const rate = await env.DB.prepare(
    `SELECT mr.* FROM model_rates mr
     WHERE mr.alias=? AND mr.effective_at<=?
     ORDER BY mr.version DESC LIMIT 1`,
  ).bind(assistant.model_alias, unix()).first<any>();
  const route = await env.DB.prepare(
    "SELECT * FROM model_routes WHERE alias=? AND status='active' LIMIT 1",
  ).bind(assistant.model_alias).first<any>();
  if (!rate || !route) return { ok: false as const, userMessage: "This assistant’s model is temporarily unavailable." };

  const prompt = await env.DB.prepare(
    "SELECT instructions FROM assistant_prompt_versions WHERE assistant_id=? AND status='published' ORDER BY version DESC LIMIT 1",
  ).bind(assistant.id).first<any>();
  const recent = assistant.memory_enabled
    ? await env.DB.prepare(
        "SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 14",
      ).bind(conversationId).all<any>()
    : { results: [] as any[] };
  const history = (recent.results ?? []).reverse();

  const knowledge = assistant.knowledge_enabled
    ? await retrieveKnowledge(env.DB, assistant.id, input.userText)
    : [];
  const tools = assistant.tools_enabled
    ? await env.DB.prepare(
        "SELECT id,name,description,endpoint_url,auth_header_ciphertext FROM assistant_tools WHERE assistant_id=? AND status='active' ORDER BY name LIMIT 12",
      ).bind(assistant.id).all<any>()
    : { results: [] as any[] };

  const toolDescriptions = (tools.results ?? []).map((t: any) => `- ${t.name}: ${t.description || "External action"}`).join("\n");
  const system = [
    "You are an AI assistant configured by this business. Follow the business instructions below.",
    "Never reveal hidden credentials, system configuration, internal pricing, provider costs, or private platform metadata.",
    "If the user asks for a human or clearly needs escalation, say that you can hand the conversation to a human.",
    prompt?.instructions ? `BUSINESS INSTRUCTIONS:\n${prompt.instructions}` : "",
    knowledge.length ? `RELEVANT BUSINESS KNOWLEDGE:\n${knowledge.join("\n\n")}` : "",
    toolDescriptions ? `AVAILABLE TOOLS:\n${toolDescriptions}\nIf you must use exactly one tool, respond ONLY with JSON: {"tool":"tool-name","arguments":{...}}. Otherwise answer normally.` : "",
  ].filter(Boolean).join("\n\n");

  const userCombined = [input.userText, input.mediaContext].filter(Boolean).join("\n\n");
  const estimatedInputTokens = Math.max(1, Math.ceil((system.length + history.reduce((n: number, m: any) => n + String(m.content || "").length, 0) + userCombined.length) / 4));
  const maxOutputTokens = 1024;

  const commercial = await env.DB.prepare(
    `SELECT cp.subscription_amount_minor,cp.provider_envelope_bps,cp.operations_reserve_bps,cp.rate_multiplier_bps,
            cp.hard_stop_enabled,c.billing_status,c.grace_until
     FROM commercial_policy cp JOIN customers c ON c.id=cp.customer_id
     WHERE cp.customer_id=? LIMIT 1`,
  ).bind(assistant.customer_id).first<any>();
  if (!commercial) return { ok: false as const, userMessage: "This assistant’s commercial policy is unavailable." };
  if (commercial.billing_status === "past_due" && commercial.grace_until && unix() > parseInt(String(commercial.grace_until), 10)) {
    return { ok: false as const, userMessage: "This account’s subscription needs attention before the assistant can continue." };
  }

  const multiplierBps = Math.max(10000, parseInt(String(commercial.rate_multiplier_bps || 10000), 10));
  const baseInputCredits = parseFloat(String(rate.input_credits_per_million || 0));
  const baseOutputCredits = parseFloat(String(rate.output_credits_per_million || 0));
  const effectiveInputCredits = Math.ceil(baseInputCredits * multiplierBps / 10000);
  const effectiveOutputCredits = Math.ceil(baseOutputCredits * multiplierBps / 10000);
  const effectiveImageCredits = Math.ceil(parseFloat(String(rate.image_credits || 0)) * multiplierBps / 10000);
  const effectiveAudioCreditsPerMinute = Math.ceil(parseFloat(String(rate.audio_credits_per_minute || 0)) * multiplierBps / 10000);
  const mediaCredits = input.imageCount * effectiveImageCredits
    + Math.ceil((input.audioSeconds / 60) * effectiveAudioCreditsPerMinute);
  const reserveAmount = Math.max(1,
    Math.ceil((estimatedInputTokens * effectiveInputCredits + maxOutputTokens * effectiveOutputCredits) / 1_000_000) + mediaCredits,
  );

  const mediaProviderCostMicros = input.imageCount * parseFloat(String(rate.provider_image_cost_micros || 0))
    + Math.ceil((input.audioSeconds / 60) * parseFloat(String(rate.provider_audio_cost_micros_per_minute || 0)));
  const estimatedProviderCostMicros = Math.max(0, Math.ceil(
    (estimatedInputTokens * parseFloat(String(rate.provider_input_cost_micros_per_million || 0))
      + maxOutputTokens * parseFloat(String(rate.provider_output_cost_micros_per_million || 0))) / 1_000_000
      + mediaProviderCostMicros,
  ));
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(
    env.DB,
    assistant.customer_id,
    commercial,
    estimatedProviderCostMicros,
  ))) {
    return { ok: false as const, userMessage: "This assistant has reached its current usage limit. Please contact the account administrator." };
  }

  const reservation = await reserveCredits(env.DB, assistant.customer_id, assistant.id, reserveAmount);
  if (!reservation) return { ok: false as const, userMessage: "This assistant has reached its current usage limit. Please contact the account administrator." };

  try {
    const aiInput = {
      messages: [
        { role: "system", content: system },
        ...history.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
        { role: "user", content: userCombined || "Please respond to the attached media." },
      ],
      max_tokens: maxOutputTokens,
      temperature: 0.4,
    };
    let result = await invokeRoutedModel(env, route, aiInput);
    let text = extractAiText(result);

    const toolCall = parseToolCall(text, tools.results ?? []);
    if (toolCall) {
      const tool = (tools.results ?? []).find((t: any) => t.name === toolCall.tool);
      if (tool) {
        const toolResult = await invokeTool(env, tool, toolCall.arguments);
        result = await invokeRoutedModel(env, route, {
          messages: [
            ...aiInput.messages,
            { role: "assistant", content: text },
            { role: "user", content: `Tool result for ${tool.name}:\n${toolResult}\nNow answer the user normally.` },
          ],
          max_tokens: maxOutputTokens,
          temperature: 0.3,
        });
        text = extractAiText(result);
      }
    }

    if (!text) throw new Error("empty model response");
    const usage = extractUsage(result, estimatedInputTokens, text);
    const actualCredits = Math.max(1,
      Math.ceil((usage.input * effectiveInputCredits + usage.output * effectiveOutputCredits) / 1_000_000) + mediaCredits,
    );
    const providerCostMicros = Math.max(0, Math.ceil(
      (usage.input * parseFloat(String(rate.provider_input_cost_micros_per_million || 0))
        + usage.output * parseFloat(String(rate.provider_output_cost_micros_per_million || 0))) / 1_000_000
        + mediaProviderCostMicros,
    ));
    await settleReservation(env.DB, reservation.id, assistant.customer_id, assistant.id, reserveAmount, actualCredits, {
      modelAlias: assistant.model_alias,
      provider: String(result?.__mketyProvider || route.provider),
      providerModel: String(result?.__mketyProviderModel || route.provider_model),
      conversationId,
      inputUnits: usage.input,
      outputUnits: usage.output,
      providerCostMicros,
    });
    return { ok: true as const, text };
  } catch (error) {
    console.error("assistant inference failed", error);
    await releaseReservation(env.DB, reservation.id, assistant.customer_id, reserveAmount);
    return { ok: false as const, userMessage: "I couldn’t complete that request just now. Please try again shortly." };
  }
}

export async function handleApiKeyInference(
  request: Request,
  env: AssistEnv,
  customer: Customer,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/v1/chat/completions") return null;
  if (request.method !== "POST") return json({ error: { message: "method_not_allowed" } }, 405);

  const auth = request.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw.startsWith("mka_")) return json({ error: { message: "invalid_api_key" } }, 401);

  const now = unix();
  const key = await env.DB.prepare(
    `SELECT * FROM customer_api_keys
     WHERE token_hash=? AND customer_id=? AND status='active'
       AND (expires_at IS NULL OR expires_at>?)
     LIMIT 1`,
  ).bind(await sha256Text(raw), customer.customerId, now).first<any>();
  if (!key) return json({ error: { message: "invalid_api_key" } }, 401);
  let scopes: string[] = [];
  try { scopes = JSON.parse(String(key.scopes_json || "[]")); } catch { scopes = []; }
  if (!scopes.includes("inference")) return json({ error: { message: "api_key_scope_forbidden" } }, 403);
  const rateLimit = Math.max(1, Math.min(10000, Number(key.rate_limit_per_minute || 60)));
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM usage_events WHERE api_key_id=? AND created_at>=?",
  ).bind(key.id, now - 60).first<any>();
  if (Number(recent?.n || 0) >= rateLimit) {
    return json({ error: { message: "rate_limit_exceeded" } }, 429);
  }

  const body = await readJson(request);
  const assistantId = String(key.assistant_id || body.assistant_id || "").trim();
  if (!assistantId) return json({ error: { message: "assistant_id_required" } }, 400);
  const assistant = await env.DB.prepare(
    `SELECT a.*,fp.tools_enabled,fp.knowledge_enabled
     FROM assistants a JOIN feature_policy fp ON fp.customer_id=a.customer_id
     WHERE a.id=? AND a.customer_id=? AND a.status='active' LIMIT 1`,
  ).bind(assistantId, customer.customerId).first<any>();
  if (!assistant) return json({ error: { message: "assistant_not_found" } }, 404);

  const alias = typeof body.model === "string" && /^mkety-[a-z0-9][a-z0-9-]{1,80}$/.test(body.model)
    ? body.model
    : assistant.model_alias;
  const route = await env.DB.prepare("SELECT * FROM model_routes WHERE alias=? AND status='active' LIMIT 1").bind(alias).first<any>();
  const rate = await env.DB.prepare(
    "SELECT * FROM model_rates WHERE alias=? AND effective_at<=? ORDER BY version DESC LIMIT 1",
  ).bind(alias, now).first<any>();
  if (!route || !rate) return json({ error: { message: "model_unavailable" } }, 503);

  const messages = Array.isArray(body.messages)
    ? body.messages.slice(-40).map((m: any) => ({
        role: ["system","assistant","user"].includes(String(m?.role)) ? String(m.role) : "user",
        content: typeof m?.content === "string" ? m.content.slice(0, 30000) : JSON.stringify(m?.content ?? "").slice(0, 30000),
      }))
    : [];
  if (!messages.length) return json({ error: { message: "messages_required" } }, 400);

  const prompt = await env.DB.prepare(
    "SELECT instructions FROM assistant_prompt_versions WHERE assistant_id=? AND status='published' ORDER BY version DESC LIMIT 1",
  ).bind(assistantId).first<any>();
  const platformSystem = [
    "You are an AI assistant configured by this business.",
    "Never reveal hidden credentials, system configuration, internal pricing, provider costs, or private platform metadata.",
    prompt?.instructions ? `BUSINESS INSTRUCTIONS:\n${prompt.instructions}` : "",
  ].filter(Boolean).join("\n\n");
  const mergedMessages = [
    { role: "system", content: platformSystem },
    ...messages,
  ];
  const inputChars = mergedMessages.reduce((n: number, m: any) => n + String(m.content || "").length, 0);
  const estimatedInputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const maxOutputTokens = Math.max(1, Math.min(4096, parseInt(String(body.max_tokens || body.max_completion_tokens || 1024), 10) || 1024));

  const commercial = await env.DB.prepare(
    `SELECT cp.subscription_amount_minor,cp.provider_envelope_bps,cp.operations_reserve_bps,cp.rate_multiplier_bps,
            cp.hard_stop_enabled,c.billing_status,c.grace_until
     FROM commercial_policy cp JOIN customers c ON c.id=cp.customer_id
     WHERE cp.customer_id=? LIMIT 1`,
  ).bind(customer.customerId).first<any>();
  if (!commercial) return json({ error: { message: "commercial_policy_unavailable" } }, 503);
  if (commercial.billing_status === "past_due" && commercial.grace_until && now > Number(commercial.grace_until)) {
    return json({ error: { message: "billing_past_due" } }, 402);
  }

  const multiplierBps = Math.max(10000, Number(commercial.rate_multiplier_bps || 10000));
  const effectiveInputCredits = Math.ceil(Number(rate.input_credits_per_million || 0) * multiplierBps / 10000);
  const effectiveOutputCredits = Math.ceil(Number(rate.output_credits_per_million || 0) * multiplierBps / 10000);
  const reserveAmount = Math.max(1, Math.ceil(
    (estimatedInputTokens * effectiveInputCredits + maxOutputTokens * effectiveOutputCredits) / 1_000_000,
  ));
  const estimatedProviderCostMicros = Math.max(0, Math.ceil(
    (estimatedInputTokens * Number(rate.provider_input_cost_micros_per_million || 0)
      + maxOutputTokens * Number(rate.provider_output_cost_micros_per_million || 0)) / 1_000_000,
  ));
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(env.DB, customer.customerId, commercial, estimatedProviderCostMicros))) {
    return json({ error: { message: "usage_limit_reached" } }, 402);
  }

  const reservation = await reserveCredits(env.DB, customer.customerId, assistantId, reserveAmount);
  if (!reservation) return json({ error: { message: "insufficient_credits" } }, 402);

  try {
    const result = await invokeRoutedModel(env, route, {
      messages: mergedMessages,
      max_tokens: maxOutputTokens,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
    });
    const text = extractAiText(result);
    if (!text) throw new Error("empty model response");
    const usage = extractUsage(result, estimatedInputTokens, text);
    const actualCredits = Math.max(1, Math.ceil(
      (usage.input * effectiveInputCredits + usage.output * effectiveOutputCredits) / 1_000_000,
    ));
    const providerCostMicros = Math.max(0, Math.ceil(
      (usage.input * Number(rate.provider_input_cost_micros_per_million || 0)
        + usage.output * Number(rate.provider_output_cost_micros_per_million || 0)) / 1_000_000,
    ));
    await settleReservation(env.DB, reservation.id, customer.customerId, assistantId, reserveAmount, actualCredits, {
      modelAlias: alias,
      provider: String(result?.__mketyProvider || route.provider),
      providerModel: String(result?.__mketyProviderModel || route.provider_model),
      conversationId: `api:${key.id}`,
      inputUnits: usage.input,
      outputUnits: usage.output,
      providerCostMicros,
      apiKeyId: key.id,
    });
    await env.DB.prepare("UPDATE customer_api_keys SET last_used_at=? WHERE id=?").bind(now, key.id).run();
    return json({
      id: `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`,
      object: "chat.completion",
      created: now,
      model: alias,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
      mkety: { credits_charged: actualCredits, assistant_id: assistantId },
    });
  } catch (error) {
    await releaseReservation(env.DB, reservation.id, customer.customerId, reserveAmount);
    console.error("Assist API inference failed", error);
    return json({ error: { message: "inference_failed" } }, 502);
  }
}

async function normalizeTelegramMessage(message: any, token: string, assistant: any, env: AssistEnv, conversationId: string) {
  const text = String(message.text || message.caption || "").trim();
  const mediaJson: any[] = [];
  const contexts: string[] = [];
  let imageCount = 0;
  let audioSeconds = 0;

  const photos = Array.isArray(message.photo) ? message.photo : [];
  const largest = photos.at(-1);
  if (largest?.file_id) {
    if (!assistant.vision_enabled) contexts.push("[An image was attached, but image understanding is disabled for this assistant.]");
    else {
      imageCount = 1;
      const asset = await downloadTelegramFile(token, largest.file_id, env, assistant, conversationId, "image", "image/jpeg");
      mediaJson.push(asset.meta);
      const vision = await describeImage(env, asset.bytes, text);
      if (vision) {
        contexts.push(`Image context: ${vision}`);
        await env.DB.prepare("UPDATE media_assets SET vision_text=? WHERE id=?").bind(vision, asset.id).run();
      }
    }
  }

  const voice = message.voice || message.audio;
  if (voice?.file_id) {
    if (!assistant.voice_enabled) contexts.push("[A voice message was attached, but voice understanding is disabled for this assistant.]");
    else {
      audioSeconds = Math.max(0, parseFloat(String(voice.duration || 0)));
      const asset = await downloadTelegramFile(token, voice.file_id, env, assistant, conversationId, "audio", voice.mime_type || "audio/ogg");
      mediaJson.push(asset.meta);
      const transcript = await transcribeAudio(env, asset.bytes);
      if (transcript) {
        contexts.push(`Voice transcript: ${transcript}`);
        await env.DB.prepare("UPDATE media_assets SET transcript=? WHERE id=?").bind(transcript, asset.id).run();
      }
    }
  }

  return { text, mediaContext: contexts.join("\n"), mediaJson, imageCount, audioSeconds };
}

async function downloadTelegramFile(token: string, fileId: string, env: AssistEnv, assistant: any, conversationId: string, kind: string, mime: string) {
  const info = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`).then((r) => r.json<any>());
  if (!info.ok || !info.result?.file_path) throw new Error("Telegram getFile failed");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
  if (!response.ok) throw new Error("Telegram file download failed");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("Telegram media exceeds 20MB");
  const assetId = id("med");
  const key = `media/${assistant.customer_id}/${assistant.id}/${assetId}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  await env.DB.prepare(
    "INSERT INTO media_assets (id,customer_id,assistant_id,conversation_id,kind,r2_key,mime_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).bind(assetId, assistant.customer_id, assistant.id, conversationId, kind, key, mime, bytes.byteLength, unix()).run();
  return { id: assetId, bytes, meta: { id: assetId, kind, mime, size: bytes.byteLength } };
}

async function describeImage(env: AssistEnv, bytes: ArrayBuffer, caption: string) {
  try {
    const b64 = arrayBufferToBase64(bytes);
    const result = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
      messages: [
        { role: "system", content: "Describe the attached image accurately and concisely for another assistant. Do not invent unreadable text." },
        { role: "user", content: [
          { type: "text", text: caption || "Describe this image." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
        ] },
      ],
      max_tokens: 500,
    });
    return extractAiText(result);
  } catch (error) {
    console.error("vision extraction failed", error);
    return "";
  }
}

async function transcribeAudio(env: AssistEnv, bytes: ArrayBuffer) {
  try {
    const result = await env.AI.run("@cf/openai/whisper", { audio: [...new Uint8Array(bytes)] });
    return String(result?.text || "").trim();
  } catch (error) {
    console.error("audio transcription failed", error);
    return "";
  }
}

async function retrieveKnowledge(db: D1Database, assistantId: string, query: string) {
  const terms = Array.from(new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4))).slice(0, 8);
  if (!terms.length) return [];
  const rows = await db.prepare(
    `SELECT ki.title,ki.content_text FROM assistant_knowledge ak
     JOIN knowledge_items ki ON ki.collection_id=ak.collection_id
     WHERE ak.assistant_id=? AND ki.status='ready' AND ki.content_text IS NOT NULL
     ORDER BY ki.updated_at DESC LIMIT 80`,
  ).bind(assistantId).all<any>();
  return (rows.results ?? [])
    .map((r: any) => {
      const text = String(r.content_text || "");
      const lower = text.toLowerCase();
      const score = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
      return { score, value: `${r.title}:\n${text.slice(0, 3500)}` };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((r) => r.value);
}

async function reserveCredits(db: D1Database, customerId: string, assistantId: string, credits: number) {
  const limit = await db.prepare("SELECT monthly_credit_cap FROM assistants WHERE id=? AND customer_id=?").bind(assistantId, customerId).first<any>();
  if (limit?.monthly_credit_cap) {
    const start = startOfMonthUnix();
    const used = await db.prepare(
      "SELECT COALESCE(SUM(credits_charged),0) AS used FROM usage_events WHERE customer_id=? AND assistant_id=? AND created_at>=?",
    ).bind(customerId, assistantId, start).first<any>();
    if (parseFloat(String(used?.used || 0)) + credits > parseFloat(String(limit.monthly_credit_cap))) return null;
  }
  const update = await db.prepare(
    "UPDATE credit_accounts SET balance=balance-?,updated_at=? WHERE customer_id=? AND balance>=?",
  ).bind(credits, unix(), customerId, credits).run();
  if (!update.meta.changes) return null;
  const reservationId = id("res");
  const balance = await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind(customerId).first<any>();
  await db.batch([
    db.prepare(
      "INSERT INTO credit_reservations (id,customer_id,assistant_id,reserved_credits,status,created_at) VALUES (?,?,?,?,?,?)",
    ).bind(reservationId, customerId, assistantId, credits, "open", unix()),
    db.prepare(
      "INSERT INTO credit_ledger (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(id("led"), customerId, assistantId, -credits, "inference_reserve", reservationId, parseFloat(String(balance?.balance || 0)), unix()),
  ]);
  return { id: reservationId };
}

async function releaseReservation(db: D1Database, reservationId: string, customerId: string, reserved: number) {
  const now = unix();
  const claimed = await db.prepare(
    "UPDATE credit_reservations SET status='released',settled_at=? WHERE id=? AND customer_id=? AND status='open' RETURNING reserved_credits",
  ).bind(now, reservationId, customerId).first<any>();
  if (!claimed) return false;
  const release = Math.max(0, parseInt(String(claimed.reserved_credits ?? reserved), 10));
  await db.prepare(
    "UPDATE credit_accounts SET balance=balance+?,updated_at=? WHERE customer_id=?",
  ).bind(release, now, customerId).run();
  const account = await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind(customerId).first<any>();
  await db.prepare(
    "INSERT INTO credit_ledger (id,customer_id,delta,kind,reference_id,balance_after,created_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(id("led"), customerId, release, "inference_release", reservationId, parseInt(String(account?.balance || 0), 10), now).run();
  return true;
}

async function settleReservation(
  db: D1Database,
  reservationId: string,
  customerId: string,
  assistantId: string,
  reserved: number,
  actual: number,
  usage: { modelAlias: string; provider: string; providerModel: string; conversationId: string; inputUnits: number; outputUnits: number; providerCostMicros: number; apiKeyId?: string | null },
) {
  const now = unix();
  const safeActual = Math.max(0, Math.min(reserved, Math.trunc(actual)));
  const claimed = await db.prepare(
    "UPDATE credit_reservations SET status='settled',settled_credits=?,settled_at=? WHERE id=? AND customer_id=? AND assistant_id=? AND status='open' RETURNING reserved_credits",
  ).bind(safeActual, now, reservationId, customerId, assistantId).first<any>();
  if (!claimed) return false;

  const originallyReserved = Math.max(0, parseInt(String(claimed.reserved_credits ?? reserved), 10));
  const refund = Math.max(0, originallyReserved - safeActual);
  await db.prepare(
    "UPDATE credit_accounts SET balance=balance+?,lifetime_consumed=lifetime_consumed+?,updated_at=? WHERE customer_id=?",
  ).bind(refund, safeActual, now, customerId).run();
  const balance = await db.prepare("SELECT balance FROM credit_accounts WHERE customer_id=?").bind(customerId).first<any>();
  const usageId = id("use");
  const statements: D1PreparedStatement[] = [
    db.prepare(
      "INSERT INTO usage_events (id,customer_id,assistant_id,conversation_id,model_alias,provider,provider_model,input_units,output_units,credits_charged,provider_cost_micros,created_at,api_key_id,reservation_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(usageId, customerId, assistantId, usage.conversationId, usage.modelAlias, usage.provider, usage.providerModel, usage.inputUnits, usage.outputUnits, safeActual, usage.providerCostMicros, now, usage.apiKeyId ?? null, reservationId),
    db.prepare(
      "INSERT INTO provider_cost_events (id,customer_id,usage_event_id,provider,provider_model,cost_micros,currency,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(id("pce"), customerId, usageId, usage.provider, usage.providerModel, usage.providerCostMicros, "USD", now),
  ];
  if (refund) {
    statements.push(
      db.prepare("INSERT INTO credit_ledger (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id("led"), customerId, assistantId, refund, "inference_settlement_refund", reservationId, parseInt(String(balance?.balance || 0), 10), now),
    );
  }
  await db.batch(statements);
  return true;
}

async function providerBudgetAllows(
  db: D1Database,
  customerId: string,
  policy: any,
  estimatedCostMicros: number,
) {
  const monthlyAmountMinor = Math.max(0, parseInt(String(policy.subscription_amount_minor || 0), 10));
  const envelopeBps = Math.max(0, Math.min(10000, parseInt(String(policy.provider_envelope_bps || 0), 10)));
  const reserveBps = Math.max(0, Math.min(9999, parseInt(String(policy.operations_reserve_bps || 0), 10)));
  if (!monthlyAmountMinor || !envelopeBps) return estimatedCostMicros <= 0;

  const monthlyUsdMicros = monthlyAmountMinor * 10000;
  const providerEnvelopeMicros = Math.floor(monthlyUsdMicros * envelopeBps / 10000);
  const usableProviderMicros = Math.floor(providerEnvelopeMicros * (10000 - reserveBps) / 10000);
  const spent = await db.prepare(
    "SELECT COALESCE(SUM(cost_micros),0) AS spent FROM provider_cost_events WHERE customer_id=? AND created_at>=?",
  ).bind(customerId, startOfMonthUnix()).first<any>();
  return parseFloat(String(spent?.spent || 0)) + estimatedCostMicros <= usableProviderMicros;
}

async function invokeRoutedModel(env: AssistEnv, route: any, input: any): Promise<any> {
  try {
    const result = await invokeProviderModel(env, {
      provider: route.provider,
      provider_model: route.provider_model,
      provider_connection_id: route.provider_connection_id,
    }, input);
    return annotateProviderResult(result, String(route.provider), String(route.provider_model));
  } catch (primaryError) {
    if (!route.fallback_provider || !route.fallback_model) throw primaryError;

    const primaryOwnership = route.provider_connection_id
      ? await env.DB.prepare("SELECT ownership FROM provider_connections WHERE id=? LIMIT 1").bind(route.provider_connection_id).first<any>()
      : null;
    const fallbackOwnership = route.fallback_provider_connection_id
      ? await env.DB.prepare("SELECT ownership FROM provider_connections WHERE id=? LIMIT 1").bind(route.fallback_provider_connection_id).first<any>()
      : null;
    const primaryIsByok = primaryOwnership?.ownership === "customer";
    const fallbackIsManaged = route.fallback_provider === "workers-ai"
      || route.fallback_provider === "mkety-managed"
      || (!route.fallback_provider_connection_id)
      || fallbackOwnership?.ownership === "mkety";

    if (!mayUseFallback(String(route.byok_policy || "managed") as any, primaryIsByok, fallbackIsManaged)) {
      console.warn("BYOK provider failed; funded fallback blocked by policy", { alias: route.alias, provider: route.provider });
      throw primaryError;
    }

    console.warn("primary model route failed; using explicitly permitted fallback", {
      alias: route.alias,
      provider: route.provider,
      fallbackProvider: route.fallback_provider,
    });
    const result = await invokeProviderModel(env, {
      provider: route.fallback_provider,
      provider_model: route.fallback_model,
      provider_connection_id: route.fallback_provider_connection_id,
    }, input);
    return annotateProviderResult(result, String(route.fallback_provider), String(route.fallback_model));
  }
}

function annotateProviderResult(result: any, provider: string, model: string) {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return { ...result, __mketyProvider: provider, __mketyProviderModel: model };
  }
  return { response: String(result ?? ""), __mketyProvider: provider, __mketyProviderModel: model };
}

function utf8(value: string | Uint8Array) {
  return typeof value === "string" ? encoder.encode(value) : value;
}

async function digestSha256(value: string | Uint8Array) {
  const data = utf8(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string | Uint8Array, value: string) {
  const data = utf8(key);
  const imported = await crypto.subtle.importKey("raw", data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}

async function buildBedrockHeaders(input: {
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
  const payloadHash = hex(await digestSha256(input.body));
  const pairs: Array<[string,string]> = [
    ["content-type","application/json"],
    ["host",input.host],
    ["x-amz-content-sha256",payloadHash],
    ["x-amz-date",amzDate],
  ];
  if (input.sessionToken) pairs.push(["x-amz-security-token",input.sessionToken]);
  pairs.sort(([a],[b]) => a.localeCompare(b));
  const canonicalHeaders = pairs.map(([k,v]) => `${k}:${v.trim()}\n`).join("");
  const signedHeaders = pairs.map(([k]) => k).join(";");
  const canonicalRequest = ["POST",input.path,"",canonicalHeaders,signedHeaders,payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/bedrock/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(await digestSha256(canonicalRequest))}`;
  const dateKey = await hmacSha256(`AWS4${input.secretAccessKey}`, dateStamp);
  const regionKey = await hmacSha256(dateKey, input.region);
  const serviceKey = await hmacSha256(regionKey, "bedrock");
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = hex(await hmacSha256(signingKey, stringToSign));
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "content-type": "application/json",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(input.sessionToken ? { "x-amz-security-token": input.sessionToken } : {}),
  };
}

async function invokeProviderModel(env: AssistEnv, route: any, input: any): Promise<any> {
  const provider = String(route.provider || "");
  if (provider === "workers-ai" || provider === "mkety-managed") {
    return env.AI.run(String(route.provider_model), input);
  }

  if (!route.provider_connection_id) throw new Error("Provider connection is not configured for this model route.");
  const connection = await env.DB.prepare(
    "SELECT provider,endpoint_url,api_key_ciphertext,extra_json,status FROM provider_connections WHERE id=? AND status='active' LIMIT 1",
  ).bind(route.provider_connection_id).first<any>();
  if (!connection?.api_key_ciphertext) throw new Error("Provider connection is unavailable.");
  if (connection.provider !== provider) throw new Error("Provider connection type does not match model route.");
  const apiKey = await revealSecret(connection.api_key_ciphertext, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
  const extra = connection.extra_json ? JSON.parse(connection.extra_json) : {};
  const model = String(route.provider_model);
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const maxTokens = parseInt(String(input.max_tokens || 1024), 10);
  const temperature = typeof input.temperature === "number" ? input.temperature : 0.4;

  if (provider === "openai" || provider === "openai-compatible") {
    const base = String(connection.endpoint_url || (provider === "openai" ? "https://api.openai.com/v1" : "")).replace(/\/$/, "");
    if (!base) throw new Error("OpenAI-compatible endpoint is missing.");
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return payload;
  }

  if (provider === "anthropic") {
    const base = String(connection.endpoint_url || "https://api.anthropic.com").replace(/\/$/, "");
    const systemMessage = messages.find((m: any) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m: any) => m.role !== "system").map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    }));
    const response = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": String(extra.anthropicVersion || "2023-06-01"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, system: String(systemMessage), messages: chatMessages, max_tokens: maxTokens, temperature }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return {
      response: Array.isArray(payload.content) ? payload.content.map((x: any) => x.text || "").join("") : "",
      usage: {
        input_tokens: payload.usage?.input_tokens,
        output_tokens: payload.usage?.output_tokens,
      },
      raw: payload,
    };
  }

  if (provider === "gemini") {
    const base = String(connection.endpoint_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
    const contents = messages.filter((m: any) => m.role !== "system").map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return {
      response: payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "",
      usage: {
        input_tokens: payload.usageMetadata?.promptTokenCount,
        output_tokens: payload.usageMetadata?.candidatesTokenCount,
      },
      raw: payload,
    };
  }

  if (provider === "azure-openai") {
    const endpoint = String(connection.endpoint_url || "").replace(/\/$/, "");
    if (!endpoint) throw new Error("Azure OpenAI endpoint is missing.");
    const apiVersion = String(extra.apiVersion || "2024-10-21");
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return payload;
  }

  if (provider === "azure-foundry") {
    const endpoint = String(connection.endpoint_url || "").replace(/\/$/, "");
    if (!endpoint) throw new Error("Azure AI Foundry endpoint is missing.");
    const apiVersion = String(extra.apiVersion || "2024-05-01-preview");
    const url = endpoint.includes("/chat/completions")
      ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}api-version=${encodeURIComponent(apiVersion)}`
      : `${endpoint}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return payload;
  }

  if (provider === "vertex") {
    const projectId = String(extra.projectId || "").trim();
    const location = String(extra.location || "global").trim();
    if (!projectId) throw new Error("Vertex projectId is missing.");
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
    const contents = messages.filter((m: any) => m.role !== "system").map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));
    const response = await fetch(
      `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return {
      response: payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "",
      usage: {
        input_tokens: payload.usageMetadata?.promptTokenCount,
        output_tokens: payload.usageMetadata?.candidatesTokenCount,
      },
      raw: payload,
    };
  }

  if (provider === "cloudflare-ai") {
    const accountId = String(extra.accountId || "").trim();
    if (!accountId) throw new Error("Cloudflare accountId is missing.");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok || payload?.success === false) {
      throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    }
    return payload?.result ?? payload;
  }

  if (provider === "bedrock") {
    const accessKeyId = String(extra.accessKeyId || "").trim();
    const region = String(extra.region || "us-east-1").trim();
    const sessionToken = String(extra.sessionToken || "").trim();
    if (!accessKeyId) throw new Error("Bedrock accessKeyId is missing.");
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    const requestPath = `/model/${encodeURIComponent(model)}/converse`;
    const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
    const body = JSON.stringify({
      system: systemText ? [{ text: systemText }] : undefined,
      messages: messages.filter((m: any) => m.role !== "system").map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: [{ text: String(m.content || "") }],
      })),
      inferenceConfig: { maxTokens, temperature },
    });
    const headers = await buildBedrockHeaders({
      accessKeyId,
      secretAccessKey: apiKey,
      sessionToken: sessionToken || undefined,
      region,
      host,
      path: requestPath,
      body,
    });
    const response = await fetch(`https://${host}${requestPath}`, { method: "POST", headers, body });
    const payload = await response.json<any>();
    if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    return {
      response: payload.output?.message?.content?.map((p: any) => p.text || "").join("") || "",
      usage: {
        input_tokens: payload.usage?.inputTokens,
        output_tokens: payload.usage?.outputTokens,
      },
      raw: payload,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function invokeTool(env: AssistEnv, tool: any, args: unknown) {
  const endpoint = validateToolEndpoint(String(tool.endpoint_url || ""));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (tool.auth_header_ciphertext) headers.authorization = await revealSecret(tool.auth_header_ciphertext, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({ arguments: args ?? {} }),
      signal: controller.signal,
      redirect: "error",
    });
    const text = await response.text();
    return clampToolResponse(`HTTP ${response.status}\n${text}`, 64 * 1024);
  } finally {
    clearTimeout(timeout);
  }
}

function parseToolCall(text: string, tools: any[]) {
  if (!tools.length) return null;
  const trimmed = text.trim().replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`$/, "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.tool !== "string" || !tools.some((t: any) => t.name === parsed.tool)) return null;
    return { tool: parsed.tool, arguments: parsed.arguments ?? {} };
  } catch {
    return null;
  }
}

async function getAssistantSecret(env: AssistEnv, assistantId: string, name: string) {
  const row = await env.DB.prepare("SELECT ciphertext FROM assistant_secrets WHERE assistant_id=? AND name=? LIMIT 1")
    .bind(assistantId, name).first<any>();
  return row?.ciphertext ? revealSecret(row.ciphertext, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY) : null;
}

function upsertSecret(db: D1Database, customerId: string, assistantId: string, name: string, ciphertext: string, now: number) {
  return db.prepare(
    `INSERT INTO assistant_secrets (id,customer_id,assistant_id,name,ciphertext,key_version,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(assistant_id,name) DO UPDATE SET ciphertext=excluded.ciphertext,key_version=excluded.key_version,updated_at=excluded.updated_at`,
  ).bind(id("sec"), customerId, assistantId, name, ciphertext, 1, now, now);
}

async function protectSecret(secret: string, configured: string) {
  const keyBytes = decodeEncryptionKey(configured);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret)));
  return `mas1.${base64Url(iv)}.${base64Url(encrypted)}`;
}

async function revealSecret(value: string, configured: string) {
  const [version, ivPart, dataPart, extra] = value.split(".");
  if (version !== "mas1" || !ivPart || !dataPart || extra) throw new Error("invalid encrypted secret");
  const key = await crypto.subtle.importKey("raw", decodeEncryptionKey(configured), { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivPart) }, key, fromBase64Url(dataPart));
  return decoder.decode(plain);
}

function decodeEncryptionKey(value: string) {
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const decoded = fromBase64Url(value);
  if (decoded.byteLength !== 32) throw new Error("MKETY_ASSIST_SECRET_ENCRYPTION_KEY must decode to 32 bytes");
  return decoded;
}

async function upsertConversation(db: D1Database, customerId: string, assistantId: string, chatId: string) {
  const existing = await db.prepare(
    "SELECT id FROM conversations WHERE customer_id=? AND assistant_id=? AND channel='telegram' AND external_conversation_id=? LIMIT 1",
  ).bind(customerId, assistantId, chatId).first<any>();
  if (existing) return existing;
  const conversationId = id("con");
  const now = unix();
  await db.prepare(
    "INSERT INTO conversations (id,customer_id,assistant_id,channel,external_conversation_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(conversationId, customerId, assistantId, "telegram", chatId, "active", now, now).run();
  return { id: conversationId };
}

async function openHandoff(db: D1Database, customerId: string, assistantId: string, conversationId: string, reason: string) {
  const current = await db.prepare("SELECT id FROM human_handoffs WHERE conversation_id=? AND status='open' LIMIT 1").bind(conversationId).first();
  if (current) return;
  await db.prepare(
    "INSERT INTO human_handoffs (id,customer_id,assistant_id,conversation_id,status,reason,created_at) VALUES (?,?,?,?,?,?,?)",
  ).bind(id("hof"), customerId, assistantId, conversationId, "open", reason.slice(0, 1000), unix()).run();
}

function shouldRequestHuman(text: string) {
  const s = text.toLowerCase();
  return ["human", "real person", "agent please", "speak to someone", "customer service", "representative"].some((needle) => s.includes(needle));
}

async function customerFeatureEnabled(
  db: D1Database,
  customerId: string,
  feature: "knowledge_enabled" | "reminders_enabled" | "tools_enabled",
) {
  const row = await db.prepare(
    `SELECT knowledge_enabled,reminders_enabled,tools_enabled FROM feature_policy WHERE customer_id=? LIMIT 1`,
  ).bind(customerId).first<any>();
  return Boolean(row?.[feature]);
}

async function assertAssistant(db: D1Database, customerId: string, assistantId: string) {
  const row = await db.prepare("SELECT id FROM assistants WHERE id=? AND customer_id=? LIMIT 1").bind(assistantId, customerId).first();
  if (!row) throw new ApiError(404, "assistant_not_found");
}

async function assertCollection(db: D1Database, customerId: string, collectionId: string) {
  const row = await db.prepare("SELECT id FROM knowledge_collections WHERE id=? AND customer_id=? LIMIT 1").bind(collectionId, customerId).first();
  if (!row) throw new ApiError(404, "knowledge_collection_not_found");
}

async function assertConversation(db: D1Database, customerId: string, conversationId: string) {
  const row = await db.prepare("SELECT id FROM conversations WHERE id=? AND customer_id=? LIMIT 1").bind(conversationId, customerId).first();
  if (!row) throw new ApiError(404, "conversation_not_found");
}

function requireAdmin(session: Session) {
  if (!["owner","admin"].includes(session.role)) throw new ApiError(403, "forbidden");
}

async function markWebhook(db: D1Database, assistantId: string, eventId: string, status: string) {
  await db.prepare(
    "UPDATE webhook_events SET status=?,processed_at=? WHERE source=? AND external_event_id=?",
  ).bind(status, unix(), `telegram:${assistantId}`, eventId).run();
}

async function telegramGetMe(token: string) {
  return fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json<any>());
}

async function telegramSetWebhook(token: string, url: string, secret: string) {
  return fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: false,
    }),
  }).then((r) => r.json<any>());
}

async function telegramSend(token: string, chatId: string, text: string) {
  const chunks = splitTelegram(text);
  let last: any = { ok: true };
  for (const chunk of chunks) {
    last = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
    }).then((r) => r.json<any>());
    if (!last.ok) return last;
  }
  return last;
}

async function telegramAction(token: string, chatId: string, action: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {}
}

function splitTelegram(text: string) {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > 3900) {
    let cut = rest.lastIndexOf("\n", 3900);
    if (cut < 1500) cut = 3900;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out.length ? out : ["…"];
}

function extractAiText(result: any) {
  if (typeof result?.response === "string") return result.response.trim();
  if (typeof result?.result?.response === "string") return result.result.response.trim();
  if (Array.isArray(result?.choices)) return String(result.choices[0]?.message?.content || result.choices[0]?.text || "").trim();
  if (typeof result?.text === "string") return result.text.trim();
  return "";
}

function extractUsage(result: any, estimatedInput: number, text: string) {
  const usage = result?.usage || result?.result?.usage || {};
  return {
    input: parseFloat(String(usage.prompt_tokens || usage.input_tokens || estimatedInput)),
    output: parseFloat(String(usage.completion_tokens || usage.output_tokens || Math.max(1, Math.ceil(text.length / 4)))),
  };
}

function required(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : value instanceof File ? "" : String(value ?? "").trim();
  if (!text) throw new ApiError(400, `missing_${field}`);
  return text;
}

async function readJson(request: Request): Promise<Record<string, any>> {
  try { return await request.json() as Record<string, any>; }
  catch { throw new ApiError(400, "invalid_json"); }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function unix() { return Math.floor(Date.now() / 1000); }
function startOfMonthUnix() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}
function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`; }
function randomToken(bytes: number) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64Url(data);
}
function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function arrayBufferToBase64(bytes: ArrayBuffer) {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
}
async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
function sanitizeFilename(name: string) { return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file"; }
function isTextMime(type: string, name: string) {
  return type.startsWith("text/") || /\.(txt|md|csv|json|html?)$/i.test(name);
}
function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function runtimeErrorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("Assist runtime error", error);
  return json({ error: "internal_error" }, 500);
}
