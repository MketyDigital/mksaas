import { pauseAssistant, pauseCustomer, resolveAutomationState, returnToAi, takeOverConversation } from "./handoff/service";
import { mayUseFallback } from "./providers/validation";
import { planReasoningTargets, providerReasoningOptions, reasoningCapabilities, type ReasoningFallbackPolicy, type ReasoningMode } from "./providers/reasoning";
import { routeTargetMediaSupported, routeTargetPricingConfigured } from "./providers/route-readiness";
import { bedrockHeadersFromCredentialJson, vertexAccessTokenFromServiceAccount } from "./providers/structured-credentials";
import { clampToolResponse, validateToolEndpoint } from "./security/outbound";
import { archiveAssistant, deleteAssistant, listAssistantVersions, normalizeReasoningFallbackPolicy, normalizeReasoningMode, recordAssistantVersion, restoreAssistant, rollbackAssistantVersion } from "./assistants/service";
import { assembleAssistantContext, buildKnowledgeQuery, capKnowledgeSnippets, selectCompletionBudget, selectReasoningEffort } from "./conversation/context";
import { emptyConversationMemory, summarizeArchivedMessages, type ConversationMemory } from "./conversation/memory";
import { contextCacheKey, readContextSnapshot, writeContextSnapshot } from "./conversation/context-cache";
import { enqueueInboundUpdate, replayInboundUpdate } from "./queues/inbound";
import { attemptIdFor, settlementJournalStub } from "./billing/settlement-journal";
import { reserveInference, releaseInferenceReservation, settleInference } from "./billing/inference-settlement";
import { createHumanApprovalAction, createHumanApprovalRequest, decideHumanApproval, findHumanApprovalAction, humanOpsActorCan, normalizeHumanOpsPermission, normalizeApprovalRequest, parseHumanDecisionCall, recordHumanApprovalReply } from "./human-approvals";
import { recordAttemptProjection, updateAttemptProjection } from "./billing/reconciliation";
import { normalizeApiKeyMode, normalizeModelAllowlist, canUseRawModelApi } from "./api-key-policy";
import { reserveRawModelCredits, releaseRawModelCredits, settleRawModelCredits } from "./billing/raw-model-settlement";
import {
  RetryableInferenceError,
  claimModelCapacity,
  classifyRetryableError,
  computeHumanDelaySeconds,
  deleteKnowledgeChunks,
  getPromptCache,
  providerHttpError,
  putPromptCache,
  replaceKnowledgeChunks,
  sha256Text as resilienceSha256Text,
} from "./resilience";
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
  CONTEXT_CACHE?: KVNamespace;
  AI: AiBinding;
  MEDIA: R2Bucket;
  MKETY_ASSIST_SECRET_ENCRYPTION_KEY: string;
  MKETY_ASSIST_TELEGRAM_AUTH_BOT_TOKEN: string;
  PORTAL_CNAME_TARGET: string;
  REPLY_QUEUE: {
    send(body: unknown, options?: { delaySeconds?: number }): Promise<void>;
  };
  INBOUND_QUEUE: { send(body: unknown): Promise<void> };
  SETTLEMENT_JOURNAL: DurableObjectNamespace<import("./billing/settlement-journal").SettlementJournal>;
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

  if (url.pathname === "/api/raw-model-api" && request.method === "GET") {
    const settings = await env.DB.prepare(
      "SELECT enabled,allowed_models_json FROM raw_model_api_settings WHERE customer_id=? LIMIT 1",
    ).bind(customer.customerId).first<any>();
    const routes = await env.DB.prepare(
      `SELECT alias FROM customer_model_routes WHERE customer_id=? AND status='active'
       UNION SELECT alias FROM model_routes WHERE status='active' ORDER BY alias`,
    ).bind(customer.customerId).all<any>();
    let allowedAliases: string[] = [];
    try { allowedAliases = normalizeModelAllowlist(settings?.allowed_models_json || "[]"); } catch { allowedAliases = []; }
    return json({ enabled: Number(settings?.enabled || 0) === 1, allowedAliases, availableAliases: (routes.results ?? []).map((row: any) => String(row.alias)) });
  }

  if (url.pathname === "/api/raw-model-api" && request.method === "PUT") {
    requireAdmin(session);
    const body = await readJson(request);
    const enabled = body.enabled === true ? 1 : 0;
    let allowedAliases: string[];
    try { allowedAliases = normalizeModelAllowlist(body.allowedAliases); }
    catch { return json({ error: "model_allowlist_invalid" }, 400); }
    const routes = await env.DB.prepare(
      `SELECT alias FROM customer_model_routes WHERE customer_id=? AND status='active'
       UNION SELECT alias FROM model_routes WHERE status='active'`,
    ).bind(customer.customerId).all<any>();
    const available = new Set((routes.results ?? []).map((row: any) => String(row.alias)));
    if (allowedAliases.some((alias) => !available.has(alias))) return json({ error: "model_route_unavailable" }, 400);
    if (enabled && !allowedAliases.length) return json({ error: "model_allowlist_required" }, 400);
    const now = unix();
    await env.DB.prepare(
      `INSERT INTO raw_model_api_settings (customer_id,enabled,allowed_models_json,updated_at,updated_by_user_id)
       VALUES (?,?,?,?,?) ON CONFLICT(customer_id) DO UPDATE SET enabled=excluded.enabled,
       allowed_models_json=excluded.allowed_models_json,updated_at=excluded.updated_at,updated_by_user_id=excluded.updated_by_user_id`,
    ).bind(customer.customerId, enabled, JSON.stringify(allowedAliases), now, session.userId).run();
    return json({ ok: true, enabled: enabled === 1, allowedAliases });
  }

  if (url.pathname === "/api/keys" && request.method === "GET") {
    requireAdmin(session);
    const rows = await env.DB.prepare(
      `SELECT k.id,k.name,k.token_prefix,k.status,k.assistant_id,k.mode,k.model_allowlist_json,k.created_at,k.last_used_at,k.expires_at,
              k.scopes_json,k.rate_limit_per_minute,a.name AS assistant_name
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
    let mode: "assistant" | "raw_model";
    try { mode = normalizeApiKeyMode(body.mode); } catch { return json({ error: "api_key_mode_invalid" }, 400); }
    const assistantId = mode === "assistant" && body.assistantId ? required(body.assistantId, "assistantId") : null;
    if (assistantId) await assertAssistant(env.DB, customer.customerId, assistantId);
    let keyModelAllowlist: string[] = [];
    if (mode === "raw_model") {
      if (body.assistantId) return json({ error: "raw_model_key_must_not_target_assistant" }, 400);
      try { keyModelAllowlist = normalizeModelAllowlist(body.modelAllowlist); } catch { return json({ error: "model_allowlist_invalid" }, 400); }
      if (!keyModelAllowlist.length) return json({ error: "model_allowlist_required" }, 400);
      const rawSettings = await env.DB.prepare("SELECT enabled,allowed_models_json FROM raw_model_api_settings WHERE customer_id=? LIMIT 1")
        .bind(customer.customerId).first<any>();
      let customerAllowlist: string[] = [];
      try { customerAllowlist = normalizeModelAllowlist(rawSettings?.allowed_models_json || "[]"); } catch {}
      if (Number(rawSettings?.enabled || 0) !== 1 || keyModelAllowlist.some((alias) => !customerAllowlist.includes(alias))) {
        return json({ error: "raw_model_api_not_enabled_for_models" }, 403);
      }
    }
    const raw = `mka_${randomToken(32)}`;
    const prefix = raw.slice(0, 12);
    const now = unix();
    const keyId = id("key");
    const expiresAt = body.expiresAt ? Math.floor(new Date(String(body.expiresAt)).getTime() / 1000) : null;
    if (expiresAt && (!Number.isFinite(expiresAt) || expiresAt <= now)) throw new ApiError(400, "invalid_expiry");
    const scopes = Array.isArray(body.scopes) ? body.scopes.map(String).filter((x: string) => x === "inference") : ["inference"];
    if (!scopes.length) return json({ error: "api_key_scope_required" }, 400);
    const rateLimitPerMinute = Math.max(1, Math.min(10000, Number(body.rateLimitPerMinute || 60)));
    await env.DB.prepare(
      "INSERT INTO customer_api_keys (id,customer_id,assistant_id,name,token_prefix,token_hash,status,created_by_user_id,created_at,expires_at,scopes_json,rate_limit_per_minute,mode,model_allowlist_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(keyId, customer.customerId, assistantId, name, prefix, await sha256Text(raw), "active", session.userId, now, expiresAt, JSON.stringify(scopes), rateLimitPerMinute, mode, JSON.stringify(keyModelAllowlist)).run();
    return json({ id: keyId, name, key: raw, prefix, assistantId, mode, modelAllowlist: keyModelAllowlist, expiresAt, scopes, rateLimitPerMinute }, 201);
  }

  if (parts[0] === "api" && parts[1] === "keys" && parts[2] && request.method === "DELETE") {
    requireAdmin(session);
    const keyId = parts[2];
    await env.DB.prepare(
      "UPDATE customer_api_keys SET status='revoked',revoked_at=? WHERE id=? AND customer_id=? AND status='active'",
    ).bind(unix(), keyId, customer.customerId).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/human-operations" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT s.assistant_id,s.approvals_enabled,s.pause_conversation,s.allowed_kinds_json,s.human_acknowledgement,s.updated_at,a.name AS assistant_name
       FROM human_operations_settings s JOIN assistants a ON a.id=s.assistant_id
       WHERE s.customer_id=? ORDER BY a.name`,
    ).bind(customer.customerId).all<any>();
    return json({ settings: rows.results ?? [] });
  }

  if (url.pathname === "/api/human-ops-destinations" && request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT d.id,d.name,d.chat_id,d.message_thread_id,d.delivery_assistant_id,d.destination_type,d.status,
              d.allowed_kinds_json,d.assistant_scope_json,d.created_at,a.name AS delivery_assistant_name
       FROM human_ops_destinations d JOIN assistants a ON a.id=d.delivery_assistant_id
       WHERE d.customer_id=? AND d.status!='revoked' ORDER BY d.created_at DESC`,
    ).bind(customer.customerId).all<any>();
    const permissions: Record<string, any[]> = {};
    for (const destination of rows.results ?? []) {
      const actors = await env.DB.prepare(
        `SELECT p.user_id,p.allowed_kinds_json,p.can_reply,u.display_name,u.email,cu.role
         FROM human_ops_actor_permissions p JOIN customer_users cu ON cu.customer_id=p.customer_id AND cu.user_id=p.user_id
         JOIN users u ON u.id=p.user_id AND u.telegram_user_id IS NOT NULL
         WHERE p.customer_id=? AND p.destination_id=? ORDER BY u.email`,
      ).bind(customer.customerId,destination.id).all<any>();
      permissions[String(destination.id)] = actors.results ?? [];
    }
    const members = await env.DB.prepare(
      `SELECT u.id,u.email,u.display_name,cu.role,u.telegram_user_id IS NOT NULL AS telegram_linked
       FROM customer_users cu JOIN users u ON u.id=cu.user_id WHERE cu.customer_id=? ORDER BY cu.created_at`,
    ).bind(customer.customerId).all<any>();
    return json({ destinations: rows.results ?? [], members: members.results ?? [], permissions });
  }

  if (parts[0] === "api" && parts[1] === "human-ops-destinations" && parts[2] && parts[3] === "permissions" && request.method === "PUT") {
    if (session.role !== "owner") return json({ error: "owner_required" },403);
    const body = await readJson(request);
    const userId = required(body.userId,"userId");
    const permission = normalizeHumanOpsPermission(body);
    const destination = await env.DB.prepare(
      "SELECT id,status FROM human_ops_destinations WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2],customer.customerId).first<any>();
    if (!destination || destination.status === "revoked") return json({ error: "destination_not_found" },404);
    const member = await env.DB.prepare(
      `SELECT cu.role,u.telegram_user_id,u.status FROM customer_users cu JOIN users u ON u.id=cu.user_id
       WHERE cu.customer_id=? AND cu.user_id=? LIMIT 1`,
    ).bind(customer.customerId,userId).first<any>();
    if (!member || member.role === "owner" || member.status !== "active" || !member.telegram_user_id) return json({ error: "linked_non_owner_member_required" },400);
    const now = unix();
    if (!permission.allowedKinds.length && !permission.canReply) {
      await env.DB.prepare("DELETE FROM human_ops_actor_permissions WHERE customer_id=? AND destination_id=? AND user_id=?")
        .bind(customer.customerId,destination.id,userId).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO human_ops_actor_permissions
         (customer_id,destination_id,user_id,allowed_kinds_json,can_reply,updated_by_user_id,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(destination_id,user_id) DO UPDATE SET
         allowed_kinds_json=excluded.allowed_kinds_json,can_reply=excluded.can_reply,
         updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`,
      ).bind(customer.customerId,destination.id,userId,JSON.stringify(permission.allowedKinds),permission.canReply?1:0,session.userId,now,now).run();
    }
    await env.DB.prepare(
      `INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(id("aud"),"customer_user",session.userId,customer.customerId,"human_ops_actor_permissions_updated","telegram_destination",destination.id,
      JSON.stringify({userId,allowedKinds:permission.allowedKinds,canReply:permission.canReply}),now).run();
    return json({ok:true,userId,...permission});
  }

  if (url.pathname === "/api/human-ops-destinations/link-challenges" && request.method === "POST") {
    requireAdmin(session);
    const body = await readJson(request);
    const deliveryAssistantId = required(body.deliveryAssistantId, "deliveryAssistantId");
    await assertAssistant(env.DB, customer.customerId, deliveryAssistantId);
    if (!(await getAssistantSecret(env, deliveryAssistantId, "telegram_bot_token")) ||
        !(await getAssistantSecret(env, deliveryAssistantId, "telegram_webhook_secret"))) return json({ error: "telegram_delivery_bot_unavailable" }, 409);
    const channel = await env.DB.prepare(
      "SELECT 1 FROM assistant_channels WHERE customer_id=? AND assistant_id=? AND channel='telegram' AND status='active' LIMIT 1",
    ).bind(customer.customerId,deliveryAssistantId).first<any>();
    if (!channel) return json({ error: "telegram_delivery_bot_unavailable" }, 409);
    const assistantIds = [...new Set((Array.isArray(body.assistantIds) ? body.assistantIds : []).map(String).filter(Boolean))].slice(0, 20);
    if (!assistantIds.length) return json({ error: "assistant_scope_required" }, 400);
    const placeholders = assistantIds.map(() => "?").join(",");
    const scoped = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM assistants WHERE customer_id=? AND id IN (${placeholders}) AND status='active'`,
    ).bind(customer.customerId, ...assistantIds).first<any>();
    if (Number(scoped?.n || 0) !== assistantIds.length) return json({ error: "assistant_scope_invalid" }, 400);
    const token = randomToken(18);
    const now = unix();
    await env.DB.prepare(
      `INSERT INTO human_ops_link_challenges (token_hash,customer_id,delivery_assistant_id,assistant_scope_json,created_by_user_id,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(await sha256Text(token), customer.customerId, deliveryAssistantId, JSON.stringify(assistantIds), session.userId, now + 600, now).run();
    await env.DB.prepare(
      `INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(id("aud"), "customer_user", session.userId, customer.customerId, "human_ops_link_challenge_created", "telegram_bot", deliveryAssistantId,
      JSON.stringify({ assistantIds }), now).run();
    return json({ command: `/link ${token}`, expiresAt: now + 600 }, 201);
  }

  if (parts[0] === "api" && parts[1] === "human-ops-destinations" && parts[2] && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    const status = String(body.status || "");
    if (!(["active", "paused", "revoked"] as string[]).includes(status)) return json({ error: "invalid_destination_status" }, 400);
    const now = unix();
    const result = await env.DB.prepare(
      "UPDATE human_ops_destinations SET status=?,updated_at=? WHERE id=? AND customer_id=? AND status!='revoked'",
    ).bind(status, now, parts[2], customer.customerId).run();
    if (!Number(result.meta?.changes || 0)) return json({ error: "destination_not_found" }, 404);
    await env.DB.prepare(
      `INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(id("aud"), "customer_user", session.userId, customer.customerId, `human_ops_destination_${status}`, "telegram_destination", parts[2], "{}", now).run();
    return json({ ok: true, status });
  }

  if (url.pathname === "/api/human-operations" && request.method === "PUT") {
    requireAdmin(session);
    const body = await readJson(request);
    const assistantId = required(body.assistantId, "assistantId");
    await assertAssistant(env.DB, customer.customerId, assistantId);
    const enabled = body.approvalsEnabled === true ? 1 : 0;
    const pause = body.pauseConversation === true ? 1 : 0;
    const previous = await env.DB.prepare("SELECT human_acknowledgement FROM human_operations_settings WHERE customer_id=? AND assistant_id=? LIMIT 1")
      .bind(customer.customerId, assistantId).first<any>();
    const acknowledgement = typeof body.humanAcknowledgement === "string"
      ? body.humanAcknowledgement.trim().slice(0, 600) || "Thanks, I have that. I’ll continue from here."
      : String(previous?.human_acknowledgement || "Thanks, I have that. I’ll continue from here.");
    const now = unix();
    await env.DB.prepare(
      `INSERT INTO human_operations_settings
       (customer_id,assistant_id,approvals_enabled,pause_conversation,human_acknowledgement,updated_at,updated_by_user_id)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(customer_id,assistant_id) DO UPDATE SET
       approvals_enabled=excluded.approvals_enabled,pause_conversation=excluded.pause_conversation,
       human_acknowledgement=excluded.human_acknowledgement,
       updated_at=excluded.updated_at,updated_by_user_id=excluded.updated_by_user_id`,
    ).bind(customer.customerId, assistantId, enabled, pause, acknowledgement, now, session.userId).run();
    return json({ ok: true, approvalsEnabled: enabled === 1, pauseConversation: pause === 1 });
  }

  if (url.pathname === "/api/human-approvals" && request.method === "GET") {
    const status = url.searchParams.get("status");
    const rows = await env.DB.prepare(
      `SELECT r.id,r.assistant_id,a.name AS assistant_name,r.conversation_id,r.requested_by,r.kind,
              r.question,r.summary,r.evidence_message_ids_json,r.status,r.decision_text,
              r.created_at,r.decided_at,r.expires_at,r.version
       FROM human_approval_requests r JOIN assistants a ON a.id=r.assistant_id
       WHERE r.customer_id=? AND (? IS NULL OR r.status=?)
       ORDER BY r.created_at DESC LIMIT 100`,
    ).bind(customer.customerId, status, status).all<any>();
    return json({ approvals: rows.results ?? [] });
  }

  if (url.pathname === "/api/human-approvals" && request.method === "POST") {
    requireAdmin(session);
    const body = await readJson(request);
    const normalized = normalizeApprovalRequest(body);
    if (!normalized) return json({ error: "invalid_approval_request" }, 400);
    const assistantId = required(body.assistantId, "assistantId");
    const conversationId = required(body.conversationId, "conversationId");
    const rawEvidence = Array.isArray(body.evidenceMessageIds) ? body.evidenceMessageIds : [];
    const evidenceMessageIds = [...new Set(rawEvidence.filter((value: unknown) => typeof value === "string").map(String))].slice(0, 20);
    if (evidenceMessageIds.length) {
      const placeholders = evidenceMessageIds.map(() => "?").join(",");
      const evidence = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM messages WHERE customer_id=? AND assistant_id=? AND conversation_id=? AND id IN (${placeholders})`,
      ).bind(customer.customerId, assistantId, conversationId, ...evidenceMessageIds).first<any>();
      if (Number(evidence?.n || 0) !== evidenceMessageIds.length) return json({ error: "approval_evidence_not_found" }, 404);
    }
    const now = unix();
    const requestedExpiry = body.expiresAt == null || body.expiresAt === "" ? now + 86400 : Number(body.expiresAt);
    if (!Number.isFinite(requestedExpiry)) return json({ error: "invalid_approval_expiry" }, 400);
    const expiresAt = Math.max(now + 60, Math.min(now + 30 * 86400, Math.trunc(requestedExpiry)));
    let result;
    try {
      result = await createHumanApprovalRequest(env.DB, {
        customerId: customer.customerId, assistantId, conversationId, requestedBy: session.userId,
        ...normalized, summary: normalized.summary, evidenceMessageIds, now, expiresAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "approval_idempotency_conflict") return json({ error: error.message }, 409);
      throw error;
    }
    if (!result) return json({ error: "human_approvals_disabled_or_conversation_not_found" }, 409);
    if (result.created) {
      await notifyHumanApprovalOwners(env, {
        customerId: customer.customerId, assistantId, approvalId: result.id,
        kind: normalized.kind, question: normalized.question, summary: normalized.summary,
        expiresAt, now,
      }).catch(() => undefined);
      await notifyHumanOpsDestinations(env, { customerId: customer.customerId, assistantId, approvalId: result.id, kind: normalized.kind,
        question: normalized.question, summary: normalized.summary, expiresAt, now }).catch(() => undefined);
    }
    return json(result, result.created ? 201 : 200);
  }

  if (parts[0] === "api" && parts[1] === "human-approvals" && parts[2] && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    const decision = String(body.decision || "");
    if (!["approved", "rejected", "answered"].includes(decision)) return json({ error: "invalid_approval_decision" }, 400);
    const decisionText = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
    if (decision === "answered" && !decisionText) return json({ error: "approval_answer_required" }, 400);
    const approval = await env.DB.prepare(
      "SELECT id,assistant_id,status,expires_at FROM human_approval_requests WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2], customer.customerId).first<any>();
    if (!approval) return json({ error: "approval_not_found" }, 404);
    const decided = await decideHumanApproval(env.DB, {
      customerId: customer.customerId, assistantId: String(approval.assistant_id), approvalId: String(approval.id),
      actorUserId: session.userId, decision: decision as "approved" | "rejected" | "answered",
      decisionText, now: unix(),
    });
    return decided ? json({ ok: true, decision }) : json({ error: Number(approval.expires_at) <= unix() ? "approval_expired" : "approval_already_decided" }, 409);
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

  if (parts[0] === "api" && parts[1] === "knowledge" && parts[2] && parts.length === 3 && request.method === "GET") {
    const collectionId = parts[2];
    await assertCollection(env.DB, customer.customerId, collectionId);
    const collection = await env.DB.prepare(
      "SELECT id,name,created_at,updated_at FROM knowledge_collections WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(collectionId, customer.customerId).first<any>();
    const items = await env.DB.prepare(
      "SELECT id,title,mime_type,status,error_code,retry_count,created_at,updated_at FROM knowledge_items WHERE collection_id=? AND customer_id=? ORDER BY updated_at DESC",
    ).bind(collectionId, customer.customerId).all<any>();
    return json({ collection, items: items.results ?? [] });
  }

  if (parts[0] === "api" && parts[1] === "knowledge" && parts[2] && parts.length === 3 && request.method === "PATCH") {
    requireAdmin(session);
    const name = required((await readJson(request)).name, "name").slice(0, 120);
    const result = await env.DB.prepare(
      "UPDATE knowledge_collections SET name=?,updated_at=? WHERE id=? AND customer_id=?",
    ).bind(name, unix(), parts[2], customer.customerId).run();
    if (!result.meta.changes) return json({ error: "knowledge_collection_not_found" }, 404);
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "knowledge" && parts[2] && parts.length === 3 && request.method === "DELETE") {
    requireAdmin(session);
    const collectionId = parts[2];
    await assertCollection(env.DB, customer.customerId, collectionId);
    const assets = await env.DB.prepare(
      "SELECT id,r2_key FROM knowledge_items WHERE collection_id=? AND customer_id=?",
    ).bind(collectionId, customer.customerId).all<any>();
    await deleteKnowledgeChunks(env.DB, (assets.results ?? []).map((row: any) => String(row.id)));
    for (const row of assets.results ?? []) if (row.r2_key) await env.MEDIA.delete(String(row.r2_key));
    await env.DB.prepare("DELETE FROM knowledge_collections WHERE id=? AND customer_id=?").bind(collectionId, customer.customerId).run();
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "knowledge-items" && parts[2] && request.method === "PATCH") {
    requireAdmin(session);
    const body = await readJson(request);
    const title = required(body.title, "title").slice(0, 200);
    const result = await env.DB.prepare(
      "UPDATE knowledge_items SET title=?,updated_at=? WHERE id=? AND customer_id=?",
    ).bind(title, unix(), parts[2], customer.customerId).run();
    if (!result.meta.changes) return json({ error: "knowledge_item_not_found" }, 404);
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "knowledge-items" && parts[2] && request.method === "DELETE") {
    requireAdmin(session);
    const item = await env.DB.prepare(
      "SELECT r2_key FROM knowledge_items WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2], customer.customerId).first<any>();
    if (!item) return json({ error: "knowledge_item_not_found" }, 404);
    if (item.r2_key) await env.MEDIA.delete(String(item.r2_key));
    await deleteKnowledgeChunks(env.DB, [parts[2]]);
    await env.DB.prepare("DELETE FROM knowledge_items WHERE id=? AND customer_id=?").bind(parts[2], customer.customerId).run();
    return json({ ok: true });
  }

  if (parts[0] === "api" && parts[1] === "knowledge-items" && parts[2] && parts[3] === "retry" && request.method === "POST") {
    requireAdmin(session);
    const item = await env.DB.prepare(
      "SELECT id,r2_key,title,mime_type FROM knowledge_items WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2], customer.customerId).first<any>();
    if (!item) return json({ error: "knowledge_item_not_found" }, 404);
    if (!item.r2_key) return json({ error: "knowledge_retry_unavailable" }, 409);
    const object = await env.MEDIA.get(String(item.r2_key));
    if (!object) return json({ error: "knowledge_source_missing" }, 409);
    const bytes = await object.arrayBuffer();
    let textual: string | null = null;
    let errorCode: string | null = null;
    try {
      const converted = await env.AI.toMarkdown(
        { name: String(item.title), blob: new Blob([bytes], { type: String(item.mime_type || "application/octet-stream") }) },
        { conversionOptions: { output: { format: "text" }, pdf: { metadata: false } } },
      );
      const result = Array.isArray(converted) ? converted[0] : converted;
      if (result?.format === "error") errorCode = String(result.error || "conversion_failed");
      else if (typeof result?.data === "string" && result.data.trim()) textual = result.data.trim();
      else errorCode = "conversion_returned_no_text";
    } catch (error) {
      errorCode = error instanceof Error ? error.message.slice(0, 300) : "conversion_failed";
    }
    await env.DB.prepare(
      "UPDATE knowledge_items SET status=?,content_text=?,error_code=?,retry_count=retry_count+1,updated_at=? WHERE id=? AND customer_id=?",
    ).bind(textual ? "ready" : "error", textual, errorCode, unix(), item.id, customer.customerId).run();
    if (textual) {
      const itemRow = await env.DB.prepare("SELECT collection_id FROM knowledge_items WHERE id=? AND customer_id=? LIMIT 1")
        .bind(item.id, customer.customerId).first<any>();
      if (itemRow?.collection_id) {
        await replaceKnowledgeChunks({
          db: env.DB,
          customerId: customer.customerId,
          collectionId: String(itemRow.collection_id),
          itemId: String(item.id),
          title: String(item.title),
          text: textual,
        });
      }
    }
    return json({ ok: Boolean(textual), status: textual ? "ready" : "error", error: errorCode });
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
         (id,customer_id,collection_id,r2_key,title,mime_type,status,content_text,metadata_json,error_code,retry_count,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        itemId, customer.customerId, collectionId, key, file.name, file.type || null,
        textual ? "ready" : "error", textual, JSON.stringify({ size: file.size }), conversionError, 0, now, now,
      ).run();
      if (textual) {
        await replaceKnowledgeChunks({
          db: env.DB,
          customerId: customer.customerId,
          collectionId,
          itemId,
          title: file.name,
          text: textual,
        });
      }
      return json({
        id: itemId,
        title: file.name,
        status: textual ? "ready" : "error",
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
    await replaceKnowledgeChunks({
      db: env.DB,
      customerId: customer.customerId,
      collectionId,
      itemId,
      title,
      text: content,
    });
    return json({ id: itemId, title, status: "ready" }, 201);
  }

  if (url.pathname === "/api/conversations" && request.method === "GET") {
    const assistantId = url.searchParams.get("assistantId");
    const query = assistantId
      ? env.DB.prepare(
          `SELECT c.id,c.assistant_id,a.name AS assistant_name,c.channel,c.external_conversation_id,c.last_sender_id,c.status,c.updated_at,
             COALESCE(sc.state,'active') AS sender_control_state,
             sc.reason AS sender_control_reason,sc.expires_at AS sender_control_expires_at,
             (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
           FROM conversations c
           JOIN assistants a ON a.id=c.assistant_id
           LEFT JOIN channel_sender_controls sc
             ON sc.assistant_id=c.assistant_id AND sc.channel=c.channel AND sc.sender_id=COALESCE(c.last_sender_id,c.external_conversation_id)
           WHERE c.customer_id=? AND c.assistant_id=? ORDER BY c.updated_at DESC LIMIT 100`,
        ).bind(customer.customerId, assistantId)
      : env.DB.prepare(
          `SELECT c.id,c.assistant_id,a.name AS assistant_name,c.channel,c.external_conversation_id,c.last_sender_id,c.status,c.updated_at,
             COALESCE(sc.state,'active') AS sender_control_state,
             sc.reason AS sender_control_reason,sc.expires_at AS sender_control_expires_at,
             (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
           FROM conversations c
           JOIN assistants a ON a.id=c.assistant_id
           LEFT JOIN channel_sender_controls sc
             ON sc.assistant_id=c.assistant_id AND sc.channel=c.channel AND sc.sender_id=COALESCE(c.last_sender_id,c.external_conversation_id)
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

  if (parts[0] === "api" && parts[1] === "conversations" && parts[2] && parts[3] === "memory" && request.method === "DELETE") {
    requireAdmin(session);
    const conversationId = parts[2];
    await assertConversation(env.DB, customer.customerId, conversationId);
    const now = unix();
    await env.DB.batch([
      env.DB.prepare("UPDATE conversations SET memory_cleared_at=?,updated_at=? WHERE id=? AND customer_id=?")
        .bind(now, now, conversationId, customer.customerId),
      env.DB.prepare("DELETE FROM memories WHERE conversation_id=? AND customer_id=?")
        .bind(conversationId, customer.customerId),
    ]);
    return json({ ok: true, memoryClearedAt: now });
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
      const resumedAt = unix();
      await env.DB.prepare(
        "UPDATE human_handoffs SET status='resolved',resolved_at=? WHERE conversation_id=? AND customer_id=? AND status='open'",
      ).bind(resumedAt, parts[2], customer.customerId).run();
      const queued = await env.DB.prepare(
        "SELECT id FROM reply_jobs WHERE conversation_id=? AND customer_id=? AND status IN ('pending','retry') ORDER BY created_at DESC,CAST(provider_message_id AS INTEGER) DESC LIMIT 1",
      ).bind(parts[2], customer.customerId).first<any>();
      if (queued?.id) {
        await env.DB.prepare("UPDATE reply_jobs SET due_at=?,last_enqueued_at=?,updated_at=? WHERE id=?")
          .bind(resumedAt, resumedAt, resumedAt, queued.id).run();
        await env.REPLY_QUEUE.send({ jobId: String(queued.id) }, { delaySeconds: 0 }).catch(() => undefined);
      }
    } else {
      await takeOverConversation(env.DB, customer.customerId, conversation.assistant_id, parts[2], session.userId);
    }
    return json({ ok: true, paused: body.paused !== false });
  }

  if (parts[0] === "api" && parts[1] === "conversations" && parts[2] && parts[3] === "sender-control" && request.method === "POST") {
    requireAdmin(session);
    const conversation = await env.DB.prepare(
      "SELECT assistant_id,channel,last_sender_id,external_conversation_id FROM conversations WHERE id=? AND customer_id=? LIMIT 1",
    ).bind(parts[2], customer.customerId).first<any>();
    if (!conversation) return json({ error: "conversation_not_found" }, 404);
    const body = await readJson(request);
    const state = String(body.state || "").toLowerCase();
    if (!["active","paused","suspended","banned"].includes(state)) return json({ error: "invalid_control_state" }, 400);
    const senderId = String(conversation.last_sender_id || conversation.external_conversation_id || "");
    if (!senderId) return json({ error: "conversation_sender_unknown" }, 409);
    const expiresAt = body.expiresAt ? Math.floor(new Date(String(body.expiresAt)).getTime() / 1000) : null;
    if (expiresAt && (!Number.isFinite(expiresAt) || expiresAt <= unix())) return json({ error: "invalid_control_expiry" }, 400);
    const reason = body.reason ? String(body.reason).trim().slice(0,500) : null;
    const now = unix();
    await env.DB.prepare(
      `INSERT INTO channel_sender_controls
       (customer_id,assistant_id,channel,sender_id,state,reason,expires_at,updated_by_operator_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,NULL,?,?)
       ON CONFLICT(assistant_id,channel,sender_id) DO UPDATE SET
         state=excluded.state,reason=excluded.reason,expires_at=excluded.expires_at,updated_at=excluded.updated_at`,
    ).bind(customer.customerId,conversation.assistant_id,conversation.channel,senderId,state,reason,expiresAt,now,now).run();
    if (state !== "active") {
      await env.DB.prepare(
        "UPDATE reply_jobs SET status='cancelled',last_error=?,completed_at=?,locked_at=NULL,updated_at=? WHERE conversation_id=? AND status IN ('pending','retry')",
      ).bind("sender_"+state,now,now,parts[2]).run();
    }
    return json({ ok: true, state, senderId });
  }

  if (url.pathname === "/api/notifications/preferences" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT kind,enabled FROM owner_notification_preferences WHERE customer_id=? AND user_id=?",
    ).bind(customer.customerId, session.userId).all<any>();
    const preferences: Record<string, boolean> = { handoff: true, reminder_failure: true, channel_health: true };
    for (const row of rows.results ?? []) preferences[String(row.kind)] = Boolean(row.enabled);
    const approvalPreference = await env.DB.prepare(
      "SELECT enabled FROM human_approval_notification_preferences WHERE customer_id=? AND user_id=? LIMIT 1",
    ).bind(customer.customerId, session.userId).first<any>();
    preferences.human_approval = approvalPreference ? Boolean(approvalPreference.enabled) : true;
    return json({ preferences });
  }

  if (url.pathname === "/api/notifications/preferences" && request.method === "PATCH") {
    const body = await readJson(request);
    const allowed = ["handoff","reminder_failure","channel_health"];
    const now = unix();
    const statements: D1PreparedStatement[] = [];
    for (const kind of allowed) {
      if (typeof body[kind] !== "boolean") continue;
      statements.push(env.DB.prepare(
        `INSERT INTO owner_notification_preferences(customer_id,user_id,kind,enabled,updated_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(customer_id,user_id,kind) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`,
      ).bind(customer.customerId, session.userId, kind, body[kind] ? 1 : 0, now));
    }
    if (typeof body.human_approval === "boolean") {
      statements.push(env.DB.prepare(
        `INSERT INTO human_approval_notification_preferences(customer_id,user_id,enabled,updated_at)
         VALUES (?,?,?,?) ON CONFLICT(customer_id,user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`,
      ).bind(customer.customerId, session.userId, body.human_approval ? 1 : 0, now));
    }
    if (statements.length) await env.DB.batch(statements);
    return json({ ok: true });
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
      `SELECT h.id,h.assistant_id,h.conversation_id,c.external_conversation_id,c.business_connection_id
       FROM human_handoffs h JOIN conversations c ON c.id=h.conversation_id
       WHERE h.id=? AND h.customer_id=? AND h.status='open' LIMIT 1`,
    ).bind(parts[2], customer.customerId).first<any>();
    if (!handoff) return json({ error: "handoff_not_found" }, 404);
    const body = await readJson(request);
    const text = required(body.text, "text");
    const token = await getAssistantSecret(env, handoff.assistant_id, "telegram_bot_token");
    if (!token) return json({ error: "telegram_not_connected" }, 409);
    const sent = await telegramSend(token, handoff.external_conversation_id, text, handoff.business_connection_id ? String(handoff.business_connection_id) : null);
    if (!sent.ok) return json({ error: "telegram_send_failed" }, 502);
    const repliedAt = unix();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(id("msg"), customer.customerId, handoff.assistant_id, handoff.conversation_id, "human", text, repliedAt),
      env.DB.prepare(
        "UPDATE reply_jobs SET status='cancelled',last_error='human_manual_reply',completed_at=?,locked_at=NULL,delivery_started_at=NULL,updated_at=? WHERE conversation_id=? AND customer_id=? AND status IN ('pending','retry','processing')",
      ).bind(repliedAt, repliedAt, handoff.conversation_id, customer.customerId),
    ]);
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
      if (assistant?.monthly_credit_cap != null) {
        assistant.monthly_credit_cap = Math.round((Number(assistant.monthly_credit_cap) / 10000) * 10000) / 10000;
      }
      if (assistant) {
        const reasoningRoute = await resolveModelRoute(env.DB, customer.customerId, String(assistant.model_alias || ""));
        const reasoningTargets = Array.isArray(reasoningRoute?.__targets) && reasoningRoute.__targets.length
          ? reasoningRoute.__targets
          : reasoningRoute ? [reasoningRoute] : [];
        assistant.reasoning_capabilities = [...new Set(["standard", ...reasoningTargets.flatMap((target: any) => {
          let configured: string[] = [];
          try { configured = JSON.parse(String(target.reasoning_capabilities_json || "[]")); } catch {}
          return reasoningCapabilities(String(target.provider || ""), String(target.provider_model || ""), configured);
        })])];
      }
      return json({ assistant, knowledge: collections.results ?? [], tools: tools.results ?? [] });
    }

    if (parts.length === 3 && request.method === "PATCH") {
      requireAdmin(session);
      const body = await readJson(request);
      const reasoningMode = body.reasoningMode === undefined ? null : normalizeReasoningMode(body.reasoningMode);
      if (body.reasoningMode !== undefined && !reasoningMode) return json({ error: "invalid_reasoning_mode" }, 400);
      const reasoningFallbackPolicy = body.reasoningFallbackPolicy === undefined
        ? null
        : normalizeReasoningFallbackPolicy(body.reasoningFallbackPolicy);
      if (body.reasoningFallbackPolicy !== undefined && !reasoningFallbackPolicy) {
        return json({ error: "invalid_reasoning_fallback_policy" }, 400);
      }
      const allowedModels = await env.DB.prepare("SELECT 1 FROM model_routes WHERE alias=? AND status='active' LIMIT 1")
        .bind(body.modelAlias || "mkety-smart").first();
      if (body.modelAlias && !allowedModels) return json({ error: "model_alias_unavailable" }, 400);
      const now = unix();
      await env.DB.prepare(
        `UPDATE assistants SET name=COALESCE(?,name),status=COALESCE(?,status),model_alias=COALESCE(?,model_alias),
         timezone=COALESCE(?,timezone),memory_enabled=COALESCE(?,memory_enabled),monthly_credit_cap=COALESCE(?,monthly_credit_cap),
         human_delay_enabled=COALESCE(?,human_delay_enabled),
         human_delay_min_seconds=COALESCE(?,human_delay_min_seconds),
         human_delay_max_seconds=COALESCE(?,human_delay_max_seconds),
         human_delay_per_char_ms=COALESCE(?,human_delay_per_char_ms),
         manual_reply_pause_seconds=COALESCE(?,manual_reply_pause_seconds),
         reasoning_mode=COALESCE(?,reasoning_mode),
         reasoning_fallback_policy=COALESCE(?,reasoning_fallback_policy),
         context_recent_message_limit=COALESCE(?,context_recent_message_limit),
         context_knowledge_char_budget=COALESCE(?,context_knowledge_char_budget),
         context_memory_char_budget=COALESCE(?,context_memory_char_budget),
         updated_at=?
         WHERE id=? AND customer_id=?`,
      ).bind(
        body.name ?? null,
        ["active","paused","disabled"].includes(body.status) ? body.status : null,
        body.modelAlias ?? null,
        body.timezone ?? null,
        typeof body.memoryEnabled === "boolean" ? (body.memoryEnabled ? 1 : 0) : null,
        body.monthlyCreditCap === undefined ? null : Math.round(Number(body.monthlyCreditCap) * 10000),
        typeof body.humanDelayEnabled === "boolean" ? (body.humanDelayEnabled ? 1 : 0) : null,
        body.humanDelayMinSeconds === undefined ? null : clampNumber(body.humanDelayMinSeconds, 0, 3600),
        body.humanDelayMaxSeconds === undefined ? null : clampNumber(body.humanDelayMaxSeconds, 0, 3600),
        body.humanDelayPerCharMs === undefined ? null : clampNumber(body.humanDelayPerCharMs, 0, 5000),
        body.manualReplyPauseSeconds === undefined ? null : clampNumber(body.manualReplyPauseSeconds, 60, 86400),
        reasoningMode,
        reasoningFallbackPolicy,
        body.contextRecentMessageLimit === undefined ? null : clampNumber(body.contextRecentMessageLimit, 4, 40),
        body.contextKnowledgeCharBudget === undefined ? null : clampNumber(body.contextKnowledgeCharBudget, 2000, 50000),
        body.contextMemoryCharBudget === undefined ? null : clampNumber(body.contextMemoryCharBudget, 1000, 20000),
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
        env.DB.prepare(
          `INSERT INTO channel_health(customer_id,assistant_id,channel,status,last_checked_at,last_success_at,last_error)
           VALUES (?,?,?,'healthy',?,?,NULL)
           ON CONFLICT(customer_id,assistant_id,channel) DO UPDATE SET status='healthy',last_checked_at=excluded.last_checked_at,last_success_at=excluded.last_success_at,last_error=NULL`,
        ).bind(customer.customerId, assistantId, "telegram", now, now),
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
        env.DB.prepare(
          `INSERT INTO channel_health(customer_id,assistant_id,channel,status,last_checked_at,last_error)
           VALUES (?,?,?,'disconnected',?,NULL)
           ON CONFLICT(customer_id,assistant_id,channel) DO UPDATE SET status='disconnected',last_checked_at=excluded.last_checked_at,last_error=NULL`,
        ).bind(customer.customerId, assistantId, "telegram", unix()),
      ]);
      return json({ ok: true });
    }

    if (parts[3] === "channel-identities" && request.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT id,channel,platform_user_id,identity_role,connection_mode,is_self_identity,created_at,updated_at
         FROM assistant_channel_identities
         WHERE assistant_id=? AND customer_id=?
         ORDER BY created_at ASC`,
      ).bind(assistantId, customer.customerId).all<any>();
      return json({ identities: rows.results ?? [] });
    }

    if (parts[3] === "channel-identities" && request.method === "POST") {
      requireAdmin(session);
      const body = await readJson(request);
      const channel = required(body.channel || "telegram", "channel").toLowerCase();
      const platformUserId = required(body.platformUserId, "platformUserId");
      const identityRole = ["owner","operator","assistant","connected_account"].includes(String(body.identityRole))
        ? String(body.identityRole)
        : "connected_account";
      const connectionMode = ["bot_api","secretary","mtproto","other"].includes(String(body.connectionMode))
        ? String(body.connectionMode)
        : "secretary";
      const now = unix();
      const identityId = id("cid");
      await env.DB.prepare(
        `INSERT INTO assistant_channel_identities
         (id,customer_id,assistant_id,channel,platform_user_id,identity_role,connection_mode,is_self_identity,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(assistant_id,channel,platform_user_id) DO UPDATE SET
           identity_role=excluded.identity_role,connection_mode=excluded.connection_mode,
           is_self_identity=excluded.is_self_identity,updated_at=excluded.updated_at`,
      ).bind(identityId,customer.customerId,assistantId,channel,platformUserId,identityRole,connectionMode,body.isSelfIdentity===false?0:1,now,now).run();
      return json({ ok: true });
    }

    if (parts[3] === "channel-identities" && parts[4] && request.method === "DELETE") {
      requireAdmin(session);
      await env.DB.prepare(
        "DELETE FROM assistant_channel_identities WHERE id=? AND assistant_id=? AND customer_id=?",
      ).bind(parts[4], assistantId, customer.customerId).run();
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

export async function handleAssistantTelegramWebhook(request: Request, env: AssistEnv, replayed = false): Promise<Response | null> {
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

  if (!replayed) {
    const webhookSecret = await getAssistantSecret(env, assistantId, "telegram_webhook_secret");
    const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!webhookSecret || !constantTimeEqual(supplied, webhookSecret)) return json({ error: "not_found" }, 404);
  }

  await env.DB.prepare(
    `INSERT INTO channel_health(customer_id,assistant_id,channel,status,last_checked_at,last_success_at,last_error)
     VALUES (?,?,?,'healthy',?,?,NULL)
     ON CONFLICT(customer_id,assistant_id,channel) DO UPDATE SET status='healthy',last_checked_at=excluded.last_checked_at,last_success_at=excluded.last_success_at,last_error=NULL`,
  ).bind(assistant.customer_id, assistantId, "telegram", unix(), unix()).run();

  const update = await readJson(request);
  const updateId = String(update.update_id ?? "");
  if (!updateId) return json({ ok: true });
  if (update.callback_query) {
    await processHumanApprovalTelegramCallback(env, assistantId, update.callback_query).catch(() => undefined);
    return json({ ok: true, callback: true });
  }
  if (!replayed) {
    try {
      await enqueueInboundUpdate(env.INBOUND_QUEUE, { assistantId, providerEventId: updateId, update });
      return json({ ok: true, queued: true, providerEventId: updateId });
    } catch (error) {
      console.error("telegram inbound queue receipt failed", error instanceof Error ? error.message : String(error));
      return json({ error: "inbound_queue_unavailable", retryable: true }, 503);
    }
  }

  const webhookSource = `telegram:${assistantId}`;
  const receivedAt = unix();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO webhook_events (id,source,external_event_id,status,received_at) VALUES (?,?,?,?,?)",
  ).bind(id("wh"), webhookSource, updateId, "received", receivedAt).run();
  const claim = await env.DB.prepare(
    `UPDATE webhook_events SET status='processing',processing_at=?
     WHERE source=? AND external_event_id=?
       AND (status IN ('received','error') OR (status='processing' AND COALESCE(processing_at,0)<?))`,
  ).bind(receivedAt, webhookSource, updateId, receivedAt - 60).run();
  if (!claim.meta.changes) {
    const existingEvent = await env.DB.prepare(
      "SELECT status FROM webhook_events WHERE source=? AND external_event_id=? LIMIT 1",
    ).bind(webhookSource, updateId).first<any>();
    if (["processed","ignored"].includes(String(existingEvent?.status || ""))) return json({ ok: true, duplicate: true });
    return json({ error: "inbound_event_in_progress", retryable: true }, 503);
  }

  if (update.business_connection?.id && update.business_connection?.user?.id) {
    const bc = update.business_connection;
    const now = unix();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO telegram_business_connections
         (id,customer_id,assistant_id,business_connection_id,business_user_id,user_chat_id,is_enabled,rights_json,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(assistant_id,business_connection_id) DO UPDATE SET
           business_user_id=excluded.business_user_id,user_chat_id=excluded.user_chat_id,
           is_enabled=excluded.is_enabled,rights_json=excluded.rights_json,updated_at=excluded.updated_at`,
      ).bind(
        id("tbc"),assistant.customer_id,assistantId,String(bc.id),String(bc.user.id),
        bc.user_chat_id == null ? null : String(bc.user_chat_id),bc.is_enabled===false?0:1,
        JSON.stringify(bc.rights || {}),now,now,
      ),
      env.DB.prepare(
        `INSERT INTO assistant_channel_identities
         (id,customer_id,assistant_id,channel,platform_user_id,identity_role,connection_mode,is_self_identity,created_at,updated_at)
         VALUES (?,?,?,?,?,'connected_account','secretary',1,?,?)
         ON CONFLICT(assistant_id,channel,platform_user_id) DO UPDATE SET
           identity_role='connected_account',connection_mode='secretary',is_self_identity=1,updated_at=excluded.updated_at`,
      ).bind(id("cid"),assistant.customer_id,assistantId,"telegram",String(bc.user.id),now,now),
    ]);
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, businessConnectionUpdated: true, enabled: bc.is_enabled !== false });
  }

  const message = update.business_message ?? update.edited_business_message ?? update.message ?? update.edited_message;
  if (["group", "supergroup"].includes(String(message?.chat?.type || ""))) {
    const operationsResult = await handleHumanOpsGroupMessage(env, assistantId, assistant, updateId, message);
    if (operationsResult) return operationsResult;
  }
  if (!message?.chat?.id || !message?.message_id) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const senderId = String(message.from?.id ?? message.chat.id);
  const providerMessageId = String(message.message_id);
  const businessConnectionId = message.business_connection_id ? String(message.business_connection_id) : null;

  if (message.sender_business_bot) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true, ignoredBusinessBotEcho: true });
  }

  if (message.from?.is_bot) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true, ignoredBotSender: true });
  }

  if (businessConnectionId) {
    const business = await env.DB.prepare(
      `SELECT business_user_id,is_enabled FROM telegram_business_connections
       WHERE assistant_id=? AND business_connection_id=? LIMIT 1`,
    ).bind(assistantId,businessConnectionId).first<any>();
    if (!business || !Number(business.is_enabled ?? 0)) {
      await markWebhook(env.DB, assistantId, updateId, "ignored");
      return json({ ok: true, ignoredInactiveBusinessConnection: true });
    }
    if (String(business.business_user_id) === senderId) {
      const cooldown = await pauseConversationForManualReply(env.DB, assistant, chatId, businessConnectionId, message);
      await markWebhook(env.DB, assistantId, updateId, "processed");
      return json({ ok: true, ignoredBusinessOwnerMessage: true, manualReplyCooldownUntil: cooldown.resumeAt });
    }
  }

  const selfIdentity = await env.DB.prepare(
    `SELECT 1 FROM assistant_channel_identities
     WHERE assistant_id=? AND channel='telegram' AND platform_user_id=? AND is_self_identity=1
     LIMIT 1`,
  ).bind(assistantId, senderId).first();
  if (selfIdentity) {
    const cooldown = await pauseConversationForManualReply(env.DB, assistant, chatId, businessConnectionId, message);
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, ignoredSelfIdentity: true, manualReplyCooldownUntil: cooldown.resumeAt });
  }

  const ownerSender = await env.DB.prepare(
    `SELECT 1
     FROM customer_users cu
     JOIN users u ON u.id=cu.user_id
     WHERE cu.customer_id=? AND cu.role IN ('owner','admin')
       AND u.telegram_user_id=?
       AND u.telegram_recovery_assistant_id=?
     LIMIT 1`,
  ).bind(assistant.customer_id, senderId, assistantId).first();
  if (ownerSender) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true, ignoredOwnerSender: true });
  }

  const senderControl = await effectiveSenderControl(env.DB, assistant.customer_id, assistantId, "telegram", senderId);
  if (senderControl.state !== "active") {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({
      ok: true,
      ignoredControlledSender: true,
      controlState: senderControl.state,
    });
  }

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
  await env.DB.prepare("UPDATE conversations SET last_sender_id=?,business_connection_id=?,updated_at=? WHERE id=? AND customer_id=?")
    .bind(senderId, businessConnectionId, unix(), conversation.id, assistant.customer_id).run();
  const inbound = await normalizeTelegramMessage(message, token, assistant, env, conversation.id);

  if (!inbound.text && !inbound.mediaContext) {
    await markWebhook(env.DB, assistantId, updateId, "ignored");
    return json({ ok: true });
  }

  const userMessageId = id("msg");
  await env.DB.prepare(
    "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,media_json,created_at) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(
    userMessageId, assistant.customer_id, assistantId, conversation.id, "user",
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
    await telegramSend(token, chatId, "Reminders are off for this conversation. Send “resume reminders” if you want them again.", businessConnectionId);
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, remindersOptedOut: true });
  }
  if (reminderCommand === "resume reminders") {
    await env.DB.prepare(
      "UPDATE conversations SET reminders_opt_out=0,updated_at=? WHERE id=? AND customer_id=? AND assistant_id=?",
    ).bind(unix(), conversation.id, assistant.customer_id, assistantId).run();
    await telegramSend(token, chatId, "Reminders are enabled again for this conversation.", businessConnectionId);
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, remindersOptedOut: false });
  }

  if (assistant.human_handoff_enabled && shouldRequestHuman(inbound.text)) {
    await openHandoff(env.DB, assistant.customer_id, assistantId, conversation.id, inbound.text);
    await notifyLinkedOwners(env, assistant.customer_id, assistantId, "handoff",
      `Human handoff requested for ${assistant.name || "your assistant"}. Open the Mkety Assist portal to take over the conversation.`);
    await telegramSend(token, chatId, "I’ve handed this conversation to a human team member. They can reply here when available.", businessConnectionId);
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, handoff: true });
  }

  const existingHandoff = await env.DB.prepare(
    "SELECT id FROM human_handoffs WHERE conversation_id=? AND status='open' LIMIT 1",
  ).bind(conversation.id).first();

  const automation = await resolveAutomationState(env.DB, assistant.customer_id, assistantId, conversation.id);

  const delayContent = [inbound.text || "", inbound.mediaContext || ""].filter(Boolean).join("\n");
  const delaySeconds = computeHumanDelaySeconds(assistant, delayContent);
  const now = unix();
  const jobId = id("rpl");
  try {
    await env.DB.prepare(
      `INSERT INTO reply_jobs
       (id,customer_id,assistant_id,conversation_id,channel,external_conversation_id,provider_message_id,sender_id,
        user_message_id,user_text,media_context,media_usage_json,image_count,audio_seconds,business_connection_id,status,due_at,attempts,max_attempts,
        last_enqueued_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,0,20,?,?,?)`,
    ).bind(
      jobId, assistant.customer_id, assistantId, conversation.id, "telegram", chatId, providerMessageId, senderId,
      userMessageId, inbound.text || "", inbound.mediaContext || "", JSON.stringify(inbound.mediaUsage || []), inbound.imageCount, inbound.audioSeconds, businessConnectionId,
      now + delaySeconds, now, now, now,
    ).run();
  } catch (error) {
    const existing = await env.DB.prepare(
      "SELECT id,status FROM reply_jobs WHERE assistant_id=? AND channel='telegram' AND provider_message_id=? LIMIT 1",
    ).bind(assistantId, providerMessageId).first<any>();
    if (!existing) throw error;
    await markWebhook(env.DB, assistantId, updateId, "processed");
    return json({ ok: true, queued: true, duplicate: true, jobId: existing.id });
  }

  try {
    await env.REPLY_QUEUE.send({ jobId }, { delaySeconds });
  } catch (error) {
    await env.DB.prepare(
      "UPDATE reply_jobs SET last_error=?,last_enqueued_at=NULL,updated_at=? WHERE id=? AND status='pending'",
    ).bind(
      `queue_enqueue_failed:${String(error instanceof Error ? error.message : error).slice(0, 300)}`,
      unix(),
      jobId,
    ).run();
  }

  if (delaySeconds <= 4) void telegramAction(token, chatId, "typing", businessConnectionId);
  await markWebhook(env.DB, assistantId, updateId, "processed");
  return json({ ok: true, queued: true, jobId, delaySeconds, awaitingHuman: Boolean(existingHandoff), automationPaused: automation.paused, pauseScope: automation.reason });
}

export async function processInboundQueue(batch: any, env: AssistEnv): Promise<void> {
  for (const message of batch.messages ?? []) {
    try {
      await replayInboundUpdate(message?.body, async (payload) => {
        const replayRequest = new Request(`https://assist-origin.mkety.app/api/telegram/${encodeURIComponent(payload.assistantId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload.update),
        });
        const response = await handleAssistantTelegramWebhook(replayRequest, env, true);
        if (response && response.status >= 500) throw new Error(`inbound_replay_http_${response.status}`);
      });
      message.ack?.();
    } catch (error) {
      console.warn("telegram inbound replay will retry", error instanceof Error ? error.message : String(error));
      message.retry?.({ delaySeconds: 15 });
    }
  }
}

export async function processReplyQueue(batch: any, env: AssistEnv): Promise<void> {
  for (const message of batch.messages ?? []) {
    const jobId = String(message?.body?.jobId || "");
    if (!jobId) {
      message.ack?.();
      continue;
    }
    try {
      const outcome = await processReplyJob(env, jobId);
      if (outcome.retry) message.retry?.({ delaySeconds: outcome.delaySeconds });
      else message.ack?.();
    } catch (error) {
      const classified = classifyRetryableError(error);
      const delaySeconds = classified.retryable ? classified.retryAfterSeconds : 30;
      await env.DB.prepare(
        "UPDATE reply_jobs SET status='retry',last_error=?,due_at=?,locked_at=NULL,updated_at=? WHERE id=? AND status!='delivered'",
      ).bind(classified.message.slice(0, 500), unix() + delaySeconds, unix(), jobId).run().catch(() => undefined);
      message.retry?.({ delaySeconds });
    }
  }
}

export async function recoverReplyJobs(env: AssistEnv): Promise<void> {
  const now = unix();
  await env.DB.prepare(
    "UPDATE reply_jobs SET status='retry',locked_at=NULL,due_at=?,updated_at=? WHERE status='processing' AND locked_at IS NOT NULL AND locked_at<?",
  ).bind(now, now, now - 300).run();

  const rows = await env.DB.prepare(
    `SELECT id,due_at FROM reply_jobs
     WHERE status IN ('pending','retry') AND due_at<=?
       AND (last_enqueued_at IS NULL OR last_enqueued_at<?)
     ORDER BY due_at ASC LIMIT 100`,
  ).bind(now, now - 30).all<any>();

  for (const row of rows.results ?? []) {
    try {
      await env.REPLY_QUEUE.send({ jobId: String(row.id) }, { delaySeconds: Math.max(0, Number(row.due_at || now) - now) });
      await env.DB.prepare("UPDATE reply_jobs SET last_enqueued_at=?,updated_at=? WHERE id=?")
        .bind(now, now, row.id).run();
    } catch (error) {
      await env.DB.prepare("UPDATE reply_jobs SET last_error=?,updated_at=? WHERE id=?")
        .bind(`requeue_failed:${String(error instanceof Error ? error.message : error).slice(0, 300)}`, now, row.id).run();
    }
  }

  await env.DB.prepare("DELETE FROM prompt_cache WHERE expires_at<?").bind(now).run();
}

export async function inspectStaleAttemptProjections(env: AssistEnv): Promise<void> {
  const cutoff = unix() - 60;
  const rows = await env.DB.prepare(
    `SELECT attempt_id,customer_id,assistant_id FROM inference_attempt_index
     WHERE status IN ('started','unknown_outcome','result_recorded') AND updated_at<?
     ORDER BY updated_at ASC LIMIT 50`,
  ).bind(cutoff).all<any>();
  const workloadRows = await env.DB.prepare(
    `SELECT attempt_id,customer_id,workload_type,workload_id,status,updated_at
     FROM workload_inference_attempt_index WHERE status IN ('started','unknown_outcome','result_recorded') AND updated_at<?
     ORDER BY updated_at ASC LIMIT 50`,
  ).bind(cutoff).all<any>();
  for (const row of [...(rows.results ?? []), ...(workloadRows.results ?? [])]) {
    const isWorkload = row.workload_type === "api_key";
    const identity = isWorkload
      ? { attemptId: String(row.attempt_id), customerId: String(row.customer_id), workloadType: "api_key" as const, workloadId: String(row.workload_id) }
      : { attemptId: String(row.attempt_id), customerId: String(row.customer_id), assistantId: String(row.assistant_id) };
    try {
      const journal = settlementJournalStub(env.SETTLEMENT_JOURNAL, identity.customerId,
        isWorkload ? String(row.workload_id) : String(row.assistant_id), isWorkload ? "api_key" : "assistant");
      let attempt = await journal.getAttempt(identity);
      if (!attempt) continue;
      if (attempt.status === "started" && Date.now() - attempt.updatedAt > 5 * 60_000) {
        attempt = await journal.markAttemptUnknown(identity);
      }
      if (["started", "unknown_outcome", "result_recorded", "settled", "not_submitted"].includes(attempt.status)) {
        await updateAttemptProjection(env.DB, {
          ...identity, status: attempt.status, provider: attempt.provider, model: attempt.model,
          inputUnits: attempt.result?.inputUnits ?? null, outputUnits: attempt.result?.outputUnits ?? null,
          reasoningUnits: attempt.result?.reasoningUnits ?? null, providerCostMicros: attempt.result?.providerCostMicros ?? null,
          rateSnapshot: attempt.result?.metadata?.targetRateJson
            ? JSON.parse(String(attempt.result.metadata.targetRateJson)) : undefined,
          resolved: attempt.status === "settled" || attempt.status === "not_submitted",
        });
      }
    } catch (error) {
      console.warn("stale inference attempt inspection failed", {
        attemptId: identity.attemptId, error: String(error instanceof Error ? error.message : error).slice(0, 180),
      });
    }
  }
}

async function processReplyJob(env: AssistEnv, jobId: string): Promise<{ retry: boolean; delaySeconds: number }> {
  const now = unix();
  let job = await env.DB.prepare(
    `SELECT r.*,a.name,a.status AS assistant_status,a.model_alias,a.memory_enabled,a.human_delay_enabled,
            a.human_delay_min_seconds,a.human_delay_max_seconds,a.human_delay_per_char_ms,
            a.context_recent_message_limit,a.context_knowledge_char_budget,a.context_memory_char_budget,
            fp.vision_enabled,fp.voice_enabled,fp.knowledge_enabled,fp.human_handoff_enabled,fp.tools_enabled
     FROM reply_jobs r
     JOIN assistants a ON a.id=r.assistant_id
     JOIN feature_policy fp ON fp.customer_id=r.customer_id
     WHERE r.id=? LIMIT 1`,
  ).bind(jobId).first<any>();
  if (!job) return { retry: false, delaySeconds: 0 };
  const isHumanReply = String(job.delivery_role || "assistant") === "human";
  if (["delivered","failed","superseded","cancelled"].includes(String(job.status))) return { retry: false, delaySeconds: 0 };

  if (Number(job.due_at || 0) > now) return { retry: true, delaySeconds: Math.max(1, Number(job.due_at) - now) };

  if (job.status === "processing" && Number(job.locked_at || 0) > now - 300) {
    return { retry: true, delaySeconds: 15 };
  }
  if (job.status === "processing") {
    await env.DB.prepare("UPDATE reply_jobs SET status='retry',locked_at=NULL,updated_at=? WHERE id=?")
      .bind(now, jobId).run();
    job.status = "retry";
  }

  if (!job.response_text) {
    const newer = await env.DB.prepare(
      `SELECT id FROM reply_jobs
       WHERE conversation_id=? AND id<>?
         AND (created_at>? OR (created_at=? AND CAST(provider_message_id AS INTEGER)>CAST(? AS INTEGER)))
         AND status IN ('pending','retry','processing')
       ORDER BY created_at DESC,CAST(provider_message_id AS INTEGER) DESC LIMIT 1`,
    ).bind(job.conversation_id, job.id, job.created_at, job.created_at, job.provider_message_id).first<any>();
    if (newer) {
      await env.DB.prepare(
        "UPDATE reply_jobs SET status='superseded',last_error=?,completed_at=?,locked_at=NULL,updated_at=? WHERE id=? AND status IN ('pending','retry')",
      ).bind("batched_into:" + String(newer.id), now, now, job.id).run();
      return { retry: false, delaySeconds: 0 };
    }
  }

  const claimed = await env.DB.prepare(
    `UPDATE reply_jobs
     SET status='processing',attempts=attempts+1,locked_at=?,updated_at=?
     WHERE id=? AND status IN ('pending','retry')
     RETURNING *`,
  ).bind(now, now, job.id).first<any>();
  if (!claimed && job.status !== "processing") {
    return { retry: false, delaySeconds: 0 };
  }
  if (claimed) job = { ...job, ...claimed };

  if (Number(job.attempts || 0) > Number(job.max_attempts || 20)) {
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='failed',last_error='max_attempts_exceeded',completed_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(now, now, job.id).run();
    return { retry: false, delaySeconds: 0 };
  }

  const pendingHumanReview = !isHumanReply && await env.DB.prepare(
    `SELECT 1 FROM human_operations_settings s
     JOIN human_approval_requests r ON r.customer_id=s.customer_id AND r.assistant_id=s.assistant_id
     WHERE s.customer_id=? AND s.assistant_id=? AND r.conversation_id=? AND s.pause_conversation=1
       AND r.status='pending' AND r.expires_at>? LIMIT 1`,
  ).bind(job.customer_id,job.assistant_id,job.conversation_id,now).first();
  if (pendingHumanReview) {
    const delaySeconds = 60;
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error='human_approval_pending',due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(now+delaySeconds,now,job.id).run();
    return { retry: true, delaySeconds };
  }

  const handoff = await env.DB.prepare(
    "SELECT id FROM human_handoffs WHERE conversation_id=? AND status='open' LIMIT 1",
  ).bind(job.conversation_id).first();
  if (handoff && !isHumanReply) {
    const delaySeconds = 60;
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error='human_handoff_open',due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(now + delaySeconds, now, job.id).run();
    return { retry: true, delaySeconds };
  }

  const automation = await resolveAutomationState(env.DB, job.customer_id, job.assistant_id, job.conversation_id);
  if ((automation.paused && !isHumanReply) || job.assistant_status !== "active") {
    const delaySeconds = 60;
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error=?,due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(`automation_paused:${String(automation.reason || job.assistant_status || "unknown")}`, now + delaySeconds, now, job.id).run();
    return { retry: true, delaySeconds };
  }

  const token = await getAssistantSecret(env, job.assistant_id, "telegram_bot_token");
  if (!token) {
    const delaySeconds = Math.min(600, 30 * Math.max(1, Number(job.attempts || 1)));
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error='assistant_telegram_token_unavailable',due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(now + delaySeconds, now, job.id).run();
    return { retry: true, delaySeconds };
  }

  let responseText = String(job.response_text || "");
  let responseFailure: string | null = null;
  if (!responseText) {
    const lastDelivered = await env.DB.prepare(
      "SELECT COALESCE(MAX(created_at),0) AS created_at FROM reply_jobs WHERE conversation_id=? AND status='delivered'",
    ).bind(job.conversation_id).first<any>();
    const afterDelivered = Number(lastDelivered?.created_at || 0);
    const batchRows = await env.DB.prepare(
      `SELECT id,user_text,media_context,media_usage_json,image_count,audio_seconds,provider_message_id,created_at,status,last_error
       FROM reply_jobs
       WHERE conversation_id=? AND created_at>?
         AND (created_at<? OR (created_at=? AND CAST(provider_message_id AS INTEGER)<=CAST(? AS INTEGER)))
         AND (
           status IN ('pending','retry','processing')
           OR (status='superseded' AND last_error LIKE 'batched_into:%')
         )
       ORDER BY created_at ASC,CAST(provider_message_id AS INTEGER) ASC LIMIT 30`,
    ).bind(job.conversation_id, afterDelivered, job.created_at, job.created_at, job.provider_message_id).all<any>();
    const unansweredBatch = batchRows.results ?? [];
    if (unansweredBatch.length > 1) {
      const messageBlocks: string[] = [];
      const combinedUsage: any[] = [];
      let combinedImages = 0;
      let combinedAudioSeconds = 0;
      for (let index = 0; index < unansweredBatch.length; index++) {
        const row = unansweredBatch[index];
        const label = `Customer message ${index + 1}`;
        const userText = String(row.user_text || "").trim();
        const mediaText = String(row.media_context || "").trim();
        messageBlocks.push([
          `[${label}]`,
          userText ? `Caption/text: ${userText}` : "Caption/text: (none)",
          mediaText ? `Attached media understanding:\n${mediaText}` : "",
        ].filter(Boolean).join("\n"));
        combinedImages += Number(row.image_count || 0);
        combinedAudioSeconds += Number(row.audio_seconds || 0);
        try {
          const usage = JSON.parse(String(row.media_usage_json || "[]"));
          if (Array.isArray(usage)) combinedUsage.push(...usage);
        } catch {}
      }
      job.user_text = [
        "The customer sent the following messages in this exact order. Treat each caption/text and its attached media as one message, then answer all still-unanswered points naturally in one coherent reply.",
        ...messageBlocks,
      ].join("\n\n");
      job.media_context = "";
      job.media_usage_json = JSON.stringify(combinedUsage);
      job.image_count = combinedImages;
      job.audio_seconds = combinedAudioSeconds;
    }
    void telegramAction(token, String(job.external_conversation_id), "typing", job.business_connection_id ? String(job.business_connection_id) : null);
    const response = await runAssistant({
      env,
      assistant: {
        ...job,
        id: job.assistant_id,
        customer_id: job.customer_id,
      },
      conversationId: String(job.conversation_id),
      userText: String(job.user_text || ""),
      mediaContext: String(job.media_context || ""),
      imageCount: Number(job.image_count || 0),
      audioSeconds: Number(job.audio_seconds || 0),
      mediaUsage: (() => { try { const value=JSON.parse(String(job.media_usage_json || "[]")); return Array.isArray(value)?value:[]; } catch { return []; } })(),
      senderId: String(job.sender_id || ""),
      providerMessageId: String(job.provider_message_id || ""),
      replyJobId: String(job.id),
    });

    if (!response.ok) {
      if (response.retryable) {
        const delaySeconds = Math.max(1, Math.min(86400, Number(response.retryAfterSeconds || 5)));
        await env.DB.prepare(
          "UPDATE reply_jobs SET status='retry',last_error=?,due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
        ).bind(String(response.error || response.userMessage).slice(0, 500), unix() + delaySeconds, unix(), job.id).run();
        return { retry: true, delaySeconds };
      }
      responseFailure = String(response.error || "inference_failed").slice(0, 500);
      responseText = response.userMessage;
    } else {
      responseText = response.text;
    }

    await env.DB.prepare(
      "UPDATE reply_jobs SET response_text=?,delivery_started_at=NULL,last_error=?,updated_at=? WHERE id=?",
    ).bind(responseText, responseFailure, unix(), job.id).run();
  }

  const beforeDeliveryAutomation = await resolveAutomationState(env.DB, job.customer_id, job.assistant_id, job.conversation_id);
  if ((beforeDeliveryAutomation.paused && !isHumanReply) || job.assistant_status !== "active") {
    const delaySeconds = 60;
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error=?,due_at=?,locked_at=NULL,delivery_started_at=NULL,updated_at=? WHERE id=? AND status='processing'",
    ).bind(`automation_paused_before_delivery:${String(beforeDeliveryAutomation.reason || job.assistant_status || "unknown")}`, unix() + delaySeconds, unix(), job.id).run();
    return { retry: true, delaySeconds };
  }

  void telegramAction(token, String(job.external_conversation_id), "typing", job.business_connection_id ? String(job.business_connection_id) : null);
  await env.DB.prepare("UPDATE reply_jobs SET delivery_started_at=?,updated_at=? WHERE id=?")
    .bind(unix(), unix(), job.id).run();
  const sent = await telegramSend(
    token,
    String(job.external_conversation_id),
    responseText,
    job.business_connection_id ? String(job.business_connection_id) : null,
    job.provider_message_id ? String(job.provider_message_id) : null,
  );
  if (!sent.ok) {
    const description = String(sent.description || "telegram_send_failed");
    const terminal = /blocked by the user|chat not found|bot was blocked/i.test(description);
    if (terminal) {
      await env.DB.prepare(
        "UPDATE reply_jobs SET status='failed',last_error=?,completed_at=?,locked_at=NULL,updated_at=? WHERE id=?",
      ).bind(description.slice(0, 500), unix(), unix(), job.id).run();
      return { retry: false, delaySeconds: 0 };
    }
    const delaySeconds = Math.min(600, 15 * Math.max(1, Number(job.attempts || 1)));
    await env.DB.prepare(
      "UPDATE reply_jobs SET status='retry',last_error=?,due_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(description.slice(0, 500), unix() + delaySeconds, unix(), job.id).run();
    return { retry: true, delaySeconds };
  }

  const deliveryId = sent?.result?.message_id ? String(sent.result.message_id) : null;
  const assistantMessageId = `msg_reply_${String(job.id).replace(/[^a-zA-Z0-9_]/g, "")}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO messages (id,customer_id,assistant_id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(assistantMessageId, job.customer_id, job.assistant_id, job.conversation_id, isHumanReply ? "human" : "assistant", responseText, unix()),
    env.DB.prepare("UPDATE conversations SET updated_at=? WHERE id=?").bind(unix(), job.conversation_id),
    env.DB.prepare(
      "UPDATE reply_jobs SET status='delivered',external_delivery_id=?,last_error=NULL,completed_at=?,locked_at=NULL,updated_at=? WHERE id=?",
    ).bind(deliveryId, unix(), unix(), job.id),
  ]);
  return { retry: false, delaySeconds: 0 };
}

export async function syncTelegramBusinessWebhookCapabilities(env: AssistEnv): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT ch.customer_id,ch.assistant_id
     FROM assistant_channels ch
     LEFT JOIN telegram_webhook_capabilities twc ON twc.assistant_id=ch.assistant_id
     WHERE ch.channel='telegram' AND ch.status='active'
       AND COALESCE(twc.version,0)<2
     ORDER BY ch.updated_at ASC LIMIT 25`,
  ).all<any>();

  for (const row of rows.results ?? []) {
    const assistantId = String(row.assistant_id);
    const customerId = String(row.customer_id);
    try {
      const token = await getAssistantSecret(env, assistantId, "telegram_bot_token");
      const secret = await getAssistantSecret(env, assistantId, "telegram_webhook_secret");
      if (!token || !secret) throw new Error("telegram_credentials_unavailable");
      const result = await telegramSetWebhook(
        token,
        `https://mkety-assist.mkety.app/api/telegram/${encodeURIComponent(assistantId)}`,
        secret,
      );
      if (!result?.ok) throw new Error(String(result?.description || "telegram_set_webhook_failed"));
      const now = unix();
      await env.DB.prepare(
        `INSERT INTO telegram_webhook_capabilities(assistant_id,customer_id,version,last_synced_at,last_error)
         VALUES (?,?,?,?,NULL)
         ON CONFLICT(assistant_id) DO UPDATE SET
           customer_id=excluded.customer_id,version=excluded.version,last_synced_at=excluded.last_synced_at,last_error=NULL`,
      ).bind(assistantId,customerId,2,now).run();
    } catch (error) {
      const now = unix();
      await env.DB.prepare(
        `INSERT INTO telegram_webhook_capabilities(assistant_id,customer_id,version,last_synced_at,last_error)
         VALUES (?,?,0,?,?)
         ON CONFLICT(assistant_id) DO UPDATE SET
           customer_id=excluded.customer_id,last_synced_at=excluded.last_synced_at,last_error=excluded.last_error`,
      ).bind(assistantId,customerId,now,String(error instanceof Error ? error.message : error).slice(0,500)).run();
    }
  }
}

export async function processDueReminders(env: AssistEnv): Promise<void> {
  const now = unix();
  const rows = await env.DB.prepare(
    `SELECT r.id,r.customer_id,r.assistant_id,r.conversation_id,r.payload_json,r.attempts,r.max_attempts,
            c.external_conversation_id,c.business_connection_id,c.reminders_opt_out,
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
      const sent = await telegramSend(token, String(chatId), String(payload.text || "Reminder"), reminder.business_connection_id ? String(reminder.business_connection_id) : null);
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
      if (terminal) {
        await notifyLinkedOwners(
          env,
          reminder.customer_id,
          reminder.assistant_id,
          "reminder_failure",
          "A Mkety Assist reminder could not be delivered after all retry attempts. Check Reminders in the portal.",
        ).catch(() => undefined);
      }
    }
  }
}

async function notifyLinkedOwners(
  env: AssistEnv,
  customerId: string,
  assistantId: string,
  kind: "handoff" | "reminder_failure" | "channel_health",
  text: string,
) {
  const token = await getAssistantSecret(env, assistantId, "telegram_bot_token");
  if (!token) return;
  const rows = await env.DB.prepare(
    `SELECT DISTINCT u.telegram_user_id
     FROM customer_users cu
     JOIN users u ON u.id=cu.user_id
     LEFT JOIN owner_notification_preferences p
       ON p.customer_id=cu.customer_id AND p.user_id=u.id AND p.kind=?
     WHERE cu.customer_id=? AND cu.role IN ('owner','admin')
       AND u.telegram_user_id IS NOT NULL
       AND u.telegram_recovery_assistant_id=?
       AND COALESCE(p.enabled,1)=1`,
  ).bind(kind, customerId, assistantId).all<any>();
  await Promise.all((rows.results ?? []).map((row: any) =>
    telegramSend(token, String(row.telegram_user_id), text).catch(() => ({ ok: false }))
  ));
}

async function notifyHumanApprovalOwners(env: AssistEnv, input: {
  customerId: string; assistantId: string; approvalId: string; kind: string;
  question: string; summary: string; expiresAt: number; now: number;
}) {
  const recipients = await env.DB.prepare(
    `SELECT DISTINCT u.id AS user_id,u.telegram_user_id,u.telegram_recovery_assistant_id AS delivery_assistant_id
     FROM customer_users cu JOIN users u ON u.id=cu.user_id
     JOIN assistants da ON da.id=u.telegram_recovery_assistant_id AND da.customer_id=cu.customer_id AND da.status='active'
     JOIN assistant_channels dc ON dc.customer_id=cu.customer_id AND dc.assistant_id=da.id AND dc.channel='telegram' AND dc.status='active'
     LEFT JOIN human_approval_notification_preferences np ON np.customer_id=cu.customer_id AND np.user_id=u.id
     WHERE cu.customer_id=? AND cu.role IN ('owner','admin')
       AND u.telegram_user_id IS NOT NULL AND u.telegram_recovery_assistant_id IS NOT NULL
       AND COALESCE(np.enabled,1)=1`,
  ).bind(input.customerId).all<any>();
  const text = `Human review requested (${input.kind})\n${input.question}${input.summary ? `\n\n${input.summary}` : ""}\n\nReview in the Mkety Assist portal for full conversation evidence.`;
  await Promise.all((recipients.results ?? []).map(async (recipient: any) => {
    const deliveryAssistantId = String(recipient.delivery_assistant_id || "");
    const token = await getAssistantSecret(env, deliveryAssistantId, "telegram_bot_token");
    if (!token) return;
    const approveToken = randomToken(18);
    const rejectToken = randomToken(18);
    await Promise.all([
      createHumanApprovalAction(env.DB, {
        token: approveToken, customerId: input.customerId, approvalId: input.approvalId,
        assistantId: input.assistantId, deliveryAssistantId, userId: String(recipient.user_id),
        decision: "approved", expiresAt: input.expiresAt, now: input.now,
      }),
      createHumanApprovalAction(env.DB, {
        token: rejectToken, customerId: input.customerId, approvalId: input.approvalId,
        assistantId: input.assistantId, deliveryAssistantId, userId: String(recipient.user_id),
        decision: "rejected", expiresAt: input.expiresAt, now: input.now,
      }),
    ]);
    const sent = await telegramSend(token, String(recipient.telegram_user_id), text, null, null, {
      inline_keyboard: [[
        { text: "Approve", callback_data: `ha:${approveToken}` },
        { text: "Reject", callback_data: `ha:${rejectToken}` },
      ]],
    });
    if (!sent?.ok) console.error("human approval Telegram notification failed", String(sent?.description || "telegram_send_failed").slice(0, 200));
  }));
}

async function notifyHumanOpsDestinations(env: AssistEnv, input: {
  customerId: string; assistantId: string; approvalId: string; kind: string; question: string; summary: string; expiresAt: number; now: number;
}) {
  const rows = await env.DB.prepare(
    `SELECT d.id,d.chat_id,d.message_thread_id,d.delivery_assistant_id,d.allowed_kinds_json,d.assistant_scope_json
     FROM human_ops_destinations d WHERE d.customer_id=? AND d.status='active'`,
  ).bind(input.customerId).all<any>();
  await Promise.all((rows.results ?? []).map(async (destination: any) => {
    let kinds: string[] = []; let assistants: string[] = [];
    try { kinds = JSON.parse(String(destination.allowed_kinds_json || "[]")); } catch {}
    try { assistants = JSON.parse(String(destination.assistant_scope_json || "[]")); } catch {}
    if (!kinds.includes(input.kind) || !assistants.includes(input.assistantId)) return;
    const token = await getAssistantSecret(env, String(destination.delivery_assistant_id), "telegram_bot_token");
    if (!token) return;
    const actionTokens = { approved: randomToken(18), rejected: randomToken(18), reply: randomToken(18) };
    await Promise.all(Object.entries(actionTokens).map(async ([action, opaque]) => env.DB.prepare(
      `INSERT INTO human_ops_actions (token_hash,customer_id,approval_id,assistant_id,destination_id,delivery_assistant_id,action,expires_at,created_at)
       SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS
       (SELECT 1 FROM human_approval_requests WHERE id=? AND customer_id=? AND assistant_id=? AND status='pending')`,
    ).bind(await sha256Text(opaque),input.customerId,input.approvalId,input.assistantId,destination.id,destination.delivery_assistant_id,
      action,input.expiresAt,input.now,input.approvalId,input.customerId,input.assistantId).run()));
    const card = `MKETY HUMAN REVIEW\n${input.kind.replace(/_/g," ")}\nRequest: ${input.approvalId}\n\nOpen the Assist portal to review customer details. This group card contains no conversation text; ordinary group messages remain internal.`;
    const sent = await telegramSend(
      token,
      String(destination.chat_id),
      card,
      null,
      null,
      {
        inline_keyboard: [
          [
            { text: "Approve", callback_data: `ho:${actionTokens.approved}` },
            { text: "Reject", callback_data: `ho:${actionTokens.rejected}` },
          ],
          [{ text: "Reply", callback_data: `ho:${actionTokens.reply}` }],
        ],
      },
    ).catch(() => ({ ok: false }));
    if (sent?.ok && sent.result?.message_id) {
      await env.DB.prepare("UPDATE human_approval_requests SET operations_destination_id=? WHERE id=? AND customer_id=? AND assistant_id=?")
        .bind(destination.id,input.approvalId,input.customerId,input.assistantId).run();
    } else console.error("Human Operations group notification failed",String(sent?.description||"telegram_send_failed").slice(0,180));
  }));
}

async function handleHumanOpsGroupMessage(env: AssistEnv, deliveryAssistantId: string, assistant: any, updateId: string, message: any): Promise<Response | null> {
  const chatId = String(message.chat.id);
  const chatType = String(message.chat.type);
  const text = String(message.text || message.caption || "").trim();
  const token = await getAssistantSecret(env,deliveryAssistantId,"telegram_bot_token");
  const link = text.match(/^\/link(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})$/i);
  if (link) {
    const tokenHash = await sha256Text(link[1]);
    const actorTelegramId = message.from?.id == null ? "" : String(message.from.id);
    const challenge = await env.DB.prepare(
      `SELECT x.customer_id,x.delivery_assistant_id,x.assistant_scope_json,x.created_by_user_id,x.expires_at
       FROM human_ops_link_challenges x JOIN customer_users cu ON cu.customer_id=x.customer_id
       JOIN users u ON u.id=cu.user_id
       WHERE x.token_hash=? AND x.delivery_assistant_id=? AND x.expires_at>? AND x.consumed_at IS NULL
       AND cu.role IN ('owner','admin') AND u.status='active' AND u.telegram_user_id=? LIMIT 1`,
    ).bind(tokenHash,deliveryAssistantId,unix(),actorTelegramId).first<any>();
    if (!challenge || !actorTelegramId || !["group","supergroup"].includes(chatType)) {
      if (token) await telegramSend(token,chatId,"This Human Operations link is invalid, expired, or your linked account is not authorized.").catch(()=>undefined);
      await markWebhook(env.DB,deliveryAssistantId,updateId,"ignored");
      return json({ok:true,operationsLink:false});
    }
    const destinationId = id("hod");
    const now = unix();
    try {
      const result = await env.DB.batch([
        env.DB.prepare(
          `UPDATE human_ops_link_challenges SET consumed_at=? WHERE token_hash=? AND customer_id=? AND delivery_assistant_id=?
           AND expires_at>? AND consumed_at IS NULL AND EXISTS (SELECT 1 FROM customer_users cu JOIN users u ON u.id=cu.user_id
             WHERE cu.customer_id=? AND cu.role IN ('owner','admin') AND u.status='active' AND u.telegram_user_id=?)`,
        ).bind(now,tokenHash,challenge.customer_id,deliveryAssistantId,now,challenge.customer_id,actorTelegramId),
        env.DB.prepare(
          `INSERT INTO human_ops_destinations
           (id,customer_id,name,chat_id,message_thread_id,delivery_assistant_id,destination_type,status,assistant_scope_json,created_by_user_id,created_at,updated_at)
           SELECT ?,customer_id,?,?,NULL,?,?,'active',assistant_scope_json,?,?,? FROM human_ops_link_challenges
           WHERE token_hash=? AND customer_id=? AND delivery_assistant_id=? AND consumed_at=?`,
        ).bind(destinationId,`Telegram ${chatType}: ${String(message.chat.title||chatId).slice(0,80)}`,chatId,deliveryAssistantId,chatType,
          challenge.created_by_user_id||null,now,now,tokenHash,challenge.customer_id,deliveryAssistantId,now),
        env.DB.prepare(
          `INSERT INTO audit_events (id,actor_type,actor_id,customer_id,action,target_type,target_id,metadata_json,created_at)
           SELECT ?, 'telegram_user', ?, ?, 'human_ops_destination_linked', 'telegram_destination', ?, ?, ?
           WHERE changes()>0 AND EXISTS (SELECT 1 FROM human_ops_destinations WHERE id=?)`,
        ).bind(id("aud"),actorTelegramId,challenge.customer_id,destinationId,JSON.stringify({chatType}),now,destinationId),
      ]);
      if (!Number(result[0]?.meta?.changes||0)||!Number(result[1]?.meta?.changes||0)) throw new Error("operations_link_race");
      if (token) await telegramSend(token,chatId,"This group is now linked as a Human Operations destination. Group messages remain internal to this group.").catch(()=>undefined);
      await markWebhook(env.DB,deliveryAssistantId,updateId,"processed");
      return json({ok:true,operationsDestinationLinked:true});
    } catch (error) {
      if (token) await telegramSend(token,chatId,"This group could not be linked. Check that it is not already linked and request a new portal code.").catch(()=>undefined);
      await markWebhook(env.DB,deliveryAssistantId,updateId,"ignored");
      return json({ok:true,operationsDestinationLinked:false});
    }
  }

  const destination = await env.DB.prepare(
    `SELECT id,customer_id,status FROM human_ops_destinations WHERE customer_id=? AND delivery_assistant_id=? AND chat_id=? AND status!='revoked' LIMIT 1`,
  ).bind(assistant.customer_id,deliveryAssistantId,chatId).first<any>();
  if (!destination) return null;
  if (destination.status !== "active" || message.from?.is_bot || !text || /^\/link\b/i.test(text)) {
    await markWebhook(env.DB,deliveryAssistantId,updateId,"ignored");
    return json({ok:true,humanOperations:true,ignored:true});
  }
  const actorTelegramId = message.from?.id == null ? "" : String(message.from.id);
  const capture = await env.DB.prepare(
    `SELECT c.id,c.customer_id,c.user_id,c.approval_id,a.assistant_id,a.conversation_id,cv.external_conversation_id,cv.business_connection_id
     FROM human_ops_reply_captures c JOIN human_ops_destinations d ON d.id=c.destination_id AND d.customer_id=c.customer_id
     JOIN human_approval_requests a ON a.id=c.approval_id AND a.customer_id=c.customer_id AND a.status='pending'
     JOIN conversations cv ON cv.id=a.conversation_id AND cv.customer_id=a.customer_id AND cv.assistant_id=a.assistant_id
     JOIN customer_users cu ON cu.customer_id=c.customer_id AND cu.user_id=c.user_id
     JOIN users u ON u.id=cu.user_id AND u.status='active' AND u.telegram_user_id=c.telegram_user_id
     WHERE c.destination_id=? AND c.telegram_user_id=? AND c.status='pending' AND c.expires_at>? AND d.status='active'
       AND (cu.role='owner' OR EXISTS (SELECT 1 FROM human_ops_actor_permissions p WHERE p.customer_id=c.customer_id
         AND p.destination_id=c.destination_id AND p.user_id=c.user_id AND p.can_reply=1)) LIMIT 1`,
  ).bind(destination.id,actorTelegramId,unix()).first<any>();
  if (!capture) {
    await markWebhook(env.DB,deliveryAssistantId,updateId,"ignored");
    return json({ok:true,humanOperations:true,internalNote:true});
  }
  const replyJobId = id("rpl");
  const now = unix();
  const replyText = text.slice(0,2000);
  const replyQueued = await recordHumanApprovalReply(env.DB,{
    customerId:String(capture.customer_id),assistantId:String(capture.assistant_id),approvalId:String(capture.approval_id),
    captureId:String(capture.id),destinationId:String(destination.id),telegramUserId:actorTelegramId,actorUserId:String(capture.user_id),
    replyText,conversationId:String(capture.conversation_id),externalConversationId:String(capture.external_conversation_id),
    businessConnectionId:capture.business_connection_id==null?null:String(capture.business_connection_id),
    replyJobId,auditId:id("aud"),now,
  });
  if (!replyQueued) {
    await env.DB.prepare("UPDATE human_ops_reply_captures SET status='cancelled' WHERE id=? AND status IN ('pending','captured')")
      .bind(capture.id).run();
    await markWebhook(env.DB,deliveryAssistantId,updateId,"ignored");
    return json({ok:true,humanOperations:true,approvalAlreadyDecided:true});
  }
  let replyEnqueued=true;
  try { await env.REPLY_QUEUE.send({jobId:replyJobId}); }
  catch(error) { replyEnqueued=false; await env.DB.prepare("UPDATE reply_jobs SET last_error=?,updated_at=? WHERE id=?").bind(`queue_enqueue_failed:${String(error).slice(0,200)}`,now,replyJobId).run(); }
  if (token) await telegramSend(token,chatId,replyEnqueued
    ? "Your reply was queued for delivery through the customer’s existing assistant channel."
    : "Your reply was recorded but could not be queued now. Assist will retry delivery.").catch(()=>undefined);
  await markWebhook(env.DB,deliveryAssistantId,updateId,"processed");
  return json({ok:true,humanOperations:true,humanReplyQueued:true});
}

async function processHumanOpsTelegramCallback(env: AssistEnv, deliveryAssistantId: string, callback: any) {
  const token = await getAssistantSecret(env,deliveryAssistantId,"telegram_bot_token");
  const callbackQueryId = String(callback?.id||"");
  const data = String(callback?.data||"");
  const opaque = data.slice(3);
  let responseText = "This Human Operations action is unavailable.";
  const chatId = callback?.message?.chat?.id == null ? "" : String(callback.message.chat.id);
  const telegramUserId = callback?.from?.id == null ? "" : String(callback.from.id);
  if (token && callbackQueryId && /^ho:[A-Za-z0-9_-]{16,64}$/.test(data) && chatId && telegramUserId) {
    const tokenHash = await sha256Text(opaque);
    const action = await env.DB.prepare(
      `SELECT x.customer_id,x.approval_id,x.assistant_id,x.destination_id,x.action,x.expires_at,d.chat_id,d.status,d.allowed_kinds_json,d.assistant_scope_json,
              r.kind,r.status AS approval_status
       FROM human_ops_actions x JOIN human_ops_destinations d ON d.id=x.destination_id AND d.customer_id=x.customer_id
       JOIN human_approval_requests r ON r.id=x.approval_id AND r.customer_id=x.customer_id AND r.assistant_id=x.assistant_id
       WHERE x.token_hash=? AND x.delivery_assistant_id=? AND x.expires_at>? AND x.used_at IS NULL LIMIT 1`,
    ).bind(tokenHash,deliveryAssistantId,unix()).first<any>();
    let kinds:string[]=[];let assistants:string[]=[];
    try{kinds=JSON.parse(String(action?.allowed_kinds_json||"[]"))}catch{}
    try{assistants=JSON.parse(String(action?.assistant_scope_json||"[]"))}catch{}
    const actor = action && String(action.chat_id)===chatId && action.status==="active" && action.approval_status==="pending" &&
      kinds.includes(String(action.kind)) && assistants.includes(String(action.assistant_id))
      ? await env.DB.prepare(
        `SELECT cu.user_id,cu.role FROM customer_users cu JOIN users u ON u.id=cu.user_id
         WHERE cu.customer_id=? AND u.status='active' AND u.telegram_user_id=? LIMIT 1`,
      ).bind(action.customer_id,telegramUserId).first<any>() : null;
    let permission:any=null;
    if (actor && actor.role!=="owner") {
      permission=await env.DB.prepare(
        "SELECT allowed_kinds_json,can_reply FROM human_ops_actor_permissions WHERE customer_id=? AND destination_id=? AND user_id=? LIMIT 1",
      ).bind(action.customer_id,action.destination_id,actor.user_id).first<any>();
      let permissionKinds:string[]=[];
      try{permissionKinds=JSON.parse(String(permission?.allowed_kinds_json||"[]"))}catch{}
      permission=permission?{allowedKinds:permissionKinds,canReply:Number(permission.can_reply)===1}:null;
    }
    if (actor && humanOpsActorCan(String(actor.role),permission,String(action.kind),String(action.action)==="reply"?"reply":"decision")) {
      const claimed = await env.DB.prepare("UPDATE human_ops_actions SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?")
        .bind(unix(),tokenHash,unix()).run();
      if (Number(claimed.meta?.changes||0)) {
        if (action.action === "reply") {
          await env.DB.prepare(
            `INSERT INTO human_ops_reply_captures (id,customer_id,destination_id,approval_id,user_id,telegram_user_id,status,expires_at,created_at)
             SELECT ?,?,?,?,?,?,'pending',?,? WHERE EXISTS (SELECT 1 FROM human_approval_requests WHERE id=? AND customer_id=? AND status='pending')`,
          ).bind(id("hor"),action.customer_id,action.destination_id,action.approval_id,actor.user_id,telegramUserId,unix()+300,unix(),action.approval_id,action.customer_id).run();
          responseText = "Reply capture is active. Send one customer-bound reply in this group within five minutes.";
        } else {
          const decided = await decideHumanApproval(env.DB,{
            customerId:String(action.customer_id),assistantId:String(action.assistant_id),approvalId:String(action.approval_id),
            actorUserId:String(actor.user_id),decision:String(action.action) as "approved"|"rejected",decisionText:"",now:unix(),
            telegramActorId:telegramUserId,destinationId:String(action.destination_id),
          });
          responseText = decided ? `Decision recorded: ${action.action}.` : "This request has already been decided or expired.";
        }
        await telegramEditMessage(token,chatId,String(callback.message?.message_id||""),responseText);
      } else responseText = "This action was already used.";
    } else responseText = "Your linked Mkety account is not authorized for this active request.";
  }
  if (token && callbackQueryId) await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callback_query_id:callbackQueryId,text:responseText}),
  }).catch(()=>undefined);
}

async function telegramEditMessage(token: string, chatId: string, messageId: string, text: string) {
  if (!messageId) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,message_id:Number(messageId),text,reply_markup:{inline_keyboard:[]}}),
  }).catch(()=>undefined);
}

async function processHumanApprovalTelegramCallback(env: AssistEnv, deliveryAssistantId: string, callback: any) {
  const token = await getAssistantSecret(env, deliveryAssistantId, "telegram_bot_token");
  const callbackQueryId = String(callback?.id || "");
  const rawData = String(callback?.data || "");
  if (rawData.startsWith("ho:")) {
    await processHumanOpsTelegramCallback(env,deliveryAssistantId,callback);
    return;
  }
  let responseText = "This review action is unavailable.";
  if (token && callbackQueryId && /^ha:[A-Za-z0-9_-]{12,40}$/.test(rawData)) {
    const tokenHash = await sha256Text(rawData.slice(3));
    const action = await findHumanApprovalAction(env.DB, tokenHash, deliveryAssistantId, unix());
    const telegramUserId = callback?.from?.id == null ? "" : String(callback.from.id);
    if (action && telegramUserId) {
      const member = await env.DB.prepare(
        `SELECT cu.role FROM customer_users cu JOIN users u ON u.id=cu.user_id
         WHERE cu.customer_id=? AND cu.user_id=? AND u.telegram_user_id=? AND cu.role IN ('owner','admin') LIMIT 1`,
      ).bind(action.customer_id, action.user_id, telegramUserId).first<any>();
      if (member) {
        const decided = await decideHumanApproval(env.DB, {
          customerId: String(action.customer_id), assistantId: String(action.assistant_id),
          approvalId: String(action.approval_id), actorUserId: String(action.user_id),
          decision: String(action.decision) as "approved" | "rejected", decisionText: "", now: unix(),
        });
        responseText = decided ? "Decision recorded." : "This request has already been decided or expired.";
      } else {
        responseText = "Your linked account is not authorized to decide this request.";
      }
    }
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: responseText }),
    }).catch(() => undefined);
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

async function buildConversationContext(env: AssistEnv, assistant: any, conversationId: string, currentUserText: string) {
  const { DB: db } = env;
  const versionState = await db.prepare(
    `SELECT COALESCE(c.memory_cleared_at,0) AS cutoff,
            COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1),0) AS latest_message_at,
            COALESCE((SELECT m.id FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1),'') AS latest_message_id
     FROM conversations c WHERE c.id=? AND c.customer_id=? AND c.assistant_id=? LIMIT 1`,
  ).bind(conversationId, assistant.customer_id, assistant.id).first<any>();
  const cutoffVersion = Number(versionState?.cutoff || 0);
  const conversationVersion = await resilienceSha256Text([
    cutoffVersion,
    Number(versionState?.latest_message_at || 0),
    String(versionState?.latest_message_id || ""),
    Number(assistant.memory_enabled ?? 1),
    Number(assistant.context_recent_message_limit || 12),
  ].join(":"));
  const cacheIdentity = {
    customerId: String(assistant.customer_id), assistantId: String(assistant.id), conversationId,
    kind: "conversation_context" as const, sourceVersion: conversationVersion,
  };
  const cached = await readContextSnapshot(env.CONTEXT_CACHE, contextCacheKey(cacheIdentity), conversationVersion);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.history) && parsed?.memory && typeof parsed.memory === "object") {
        return { history: parsed.history, memory: parseConversationMemory(JSON.stringify(parsed.memory)) };
      }
    } catch {
      // Treat corrupt cache values as misses and rebuild from D1.
    }
  }
  if (!Number(assistant.memory_enabled ?? 1)) {
    const empty = { history: [] as any[], memory: emptyConversationMemory() };
    await writeContextSnapshot(env.CONTEXT_CACHE, { ...cacheIdentity, value: JSON.stringify(empty), ttlSeconds: 300 });
    return empty;
  }
  const recentLimit = Math.max(4, Math.min(40, Number(assistant.context_recent_message_limit || 12)));
  const cutoffRow = await db.prepare("SELECT COALESCE(memory_cleared_at,0) AS cutoff FROM conversations WHERE id=? LIMIT 1")
    .bind(conversationId).first<any>();
  const cutoff = Number(cutoffRow?.cutoff || 0);

  const recent = await db.prepare(
    "SELECT id,role,content,created_at FROM messages WHERE conversation_id=? AND created_at>? ORDER BY created_at DESC,id DESC LIMIT ?",
  ).bind(conversationId, cutoff, recentLimit + 2).all<any>();
  let history = (recent.results ?? []).reverse();
  if (history.length) {
    const last = history.at(-1);
    if (last?.role === "user" && normalizeComparable(String(last.content || "")) === normalizeComparable(currentUserText)) {
      history = history.slice(0, -1);
    }
  }
  if (history.length > recentLimit) history = history.slice(-recentLimit);

  const existing = await db.prepare(
    "SELECT summary_text,through_message_created_at,source_message_count FROM conversation_summaries WHERE conversation_id=? LIMIT 1",
  ).bind(conversationId).first<any>();
  const earliestRecent = history.length ? Number(history[0].created_at || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  const existingThrough = Number(existing?.through_message_created_at || 0);
  const through = Math.max(cutoff, existingThrough);
  const older = await db.prepare(
    `SELECT role,content,created_at FROM messages
     WHERE conversation_id=? AND created_at>? AND created_at<? AND created_at>?
     ORDER BY created_at ASC LIMIT 80`,
  ).bind(conversationId, cutoff, earliestRecent, through).all<any>();

  const existingMemory = existingThrough > cutoff ? parseConversationMemory(existing?.summary_text) : emptyConversationMemory();
  const olderMessages = (older.results ?? []).map((m: any) => ({
    role: String(m.role),
    content: String(m.content || ""),
    createdAt: Number(m.created_at || 0),
  }));
  const { summary: memory } = await summarizeArchivedMessages({
    existingSummary: existingMemory,
    existingSummaryThrough: existingThrough,
    memoryClearedAt: cutoff,
    messages: olderMessages,
    archivedSinceLastSummary: olderMessages.length,
    recentWindowWouldLoseContext: olderMessages.length > 0,
  });
  if ((older.results ?? []).length) {
    const lastThrough = Number((older.results ?? []).at(-1)?.created_at || through);
    const count = Number(existing?.source_message_count || 0) + (older.results ?? []).length;
    await db.prepare(
      `INSERT INTO conversation_summaries
       (conversation_id,customer_id,assistant_id,summary_text,through_message_created_at,source_message_count,updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary_text=excluded.summary_text,
         through_message_created_at=excluded.through_message_created_at,
         source_message_count=excluded.source_message_count,
         updated_at=excluded.updated_at`,
    ).bind(conversationId,assistant.customer_id,assistant.id,JSON.stringify(memory),lastThrough,count,unix()).run();
  }

  const result = { history, memory };
  await writeContextSnapshot(env.CONTEXT_CACHE, { ...cacheIdentity, value: JSON.stringify(result), ttlSeconds: 300 });
  return result;
}

function parseConversationMemory(value: unknown): ConversationMemory {
  const serialized = String(value || "").trim();
  if (!serialized) return emptyConversationMemory();
  try {
    const parsed = JSON.parse(serialized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        preferences: Array.isArray(parsed.preferences) ? parsed.preferences.map(String) : [],
        knownFacts: Array.isArray(parsed.knownFacts) ? parsed.knownFacts.map(String) : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals.map(String) : [],
        openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
        commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map(String) : [],
        latestState: String(parsed.latestState || ""),
      };
    }
  } catch {
    // Existing pre-structured summaries are retained as legacy factual context.
  }
  return { ...emptyConversationMemory(), knownFacts: [serialized.slice(0, 1024)] };
}

function normalizeComparable(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function staticAssistantContext(env: AssistEnv, assistant: any, instructions: string, toolDescriptions: string, sourceVersion: string) {
  const sourceHash = await resilienceSha256Text("context-envelope-v3\n" + sourceVersion + "\n" + instructions + "\n" + toolDescriptions);
  const cacheIdentity = {
    customerId: String(assistant.customer_id), assistantId: String(assistant.id),
    kind: "published_prompt_tools" as const, sourceVersion: sourceHash,
  };
  const snapshot = await readContextSnapshot(env.CONTEXT_CACHE, contextCacheKey(cacheIdentity), sourceHash);
  if (snapshot) return snapshot;
  const cacheKey = `static-context:${assistant.id}`;
  const cached = await getPromptCache(env.DB, cacheKey, sourceHash);
  if (cached) return cached;
  const value = assembleAssistantContext({
    businessInstructions: instructions,
    memory: "",
    knowledgeSnippets: [],
    tools: "",
    recentTurns: [],
    currentTurn: { text: "" },
  }).system;
  await putPromptCache({
    db: env.DB,
    cacheKey,
    customerId: assistant.customer_id,
    assistantId: assistant.id,
    kind: "static_context",
    value,
    sourceHash,
    ttlSeconds: 86400,
  });
  await writeContextSnapshot(env.CONTEXT_CACHE, { ...cacheIdentity, value, ttlSeconds: 900 });
  return value;
}

async function runAssistant(input: {
  env: AssistEnv;
  assistant: any;
  conversationId: string;
  userText: string;
  mediaContext: string;
  imageCount: number;
  audioSeconds: number;
  mediaUsage: any[];
  senderId: string;
  providerMessageId: string;
  replyJobId: string;
}) {
  const { env, assistant, conversationId } = input;
  const automation = await resolveAutomationState(env.DB, assistant.customer_id, assistant.id, conversationId);
  if (automation.paused) return { ok: false as const, paused: true as const, userMessage: "Automation is paused for this conversation." };

  const rate = await env.DB.prepare(
    `SELECT mr.* FROM model_rates mr
     WHERE mr.alias=? AND mr.effective_at<=?
     ORDER BY mr.version DESC LIMIT 1`,
  ).bind(assistant.model_alias, unix()).first<any>();
  const route = await resolveModelRoute(env.DB, assistant.customer_id, assistant.model_alias);
  if (!rate || !route) return { ok: false as const, userMessage: "This assistant’s model is temporarily unavailable." };

  const prompt = await env.DB.prepare(
    "SELECT version,instructions FROM assistant_prompt_versions WHERE customer_id=? AND assistant_id=? AND status='published' ORDER BY version DESC LIMIT 1",
  ).bind(assistant.customer_id, assistant.id).first<any>();
  const humanOpsSetting = await env.DB.prepare(
    "SELECT approvals_enabled,allowed_kinds_json,human_acknowledgement FROM human_operations_settings WHERE customer_id=? AND assistant_id=? LIMIT 1",
  ).bind(assistant.customer_id,assistant.id).first<any>();
  let humanOpsKinds: string[] = [];
  try { humanOpsKinds = JSON.parse(String(humanOpsSetting?.allowed_kinds_json||"[]")); } catch {}
  const humanOpsEnabled = Number(humanOpsSetting?.approvals_enabled||0)===1 && humanOpsKinds.length>0;
  const tools = assistant.tools_enabled
    ? await env.DB.prepare(
        "SELECT id,name,description,endpoint_url,auth_header_ciphertext,updated_at FROM assistant_tools WHERE customer_id=? AND assistant_id=? AND status='active' ORDER BY name LIMIT 12",
      ).bind(assistant.customer_id, assistant.id).all<any>()
    : { results: [] as any[] };

  const toolDescriptions = (tools.results ?? []).map((t: any) => `- ${t.name}: ${t.description || "External action"}`).join("\n");
  const toolVersion = (tools.results ?? []).map((tool: any) => `${tool.id}:${tool.updated_at}`).join(",");
  const promptToolVersion = await resilienceSha256Text(`${Number(prompt?.version || 0)}:${toolVersion}`);
  const staticContext = await staticAssistantContext(env, assistant, String(prompt?.instructions || ""), toolDescriptions, promptToolVersion);
  const userCombined = assembleAssistantContext({
    businessInstructions: String(prompt?.instructions || ""),
    memory: "",
    knowledgeSnippets: [],
    tools: "",
    recentTurns: [],
    currentTurn: { text: input.userText, mediaContext: input.mediaContext },
  }).userContent;
  const conversationContext = await buildConversationContext(env, assistant, conversationId, userCombined);
  const history = conversationContext.history;
  const knowledgeBudget = Math.max(2000, Math.min(50000, Number(assistant.context_knowledge_char_budget || 12000)));
  const knowledgeQuery = buildKnowledgeQuery(input.userText || input.mediaContext, history.map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || ""),
  })));
  const knowledge = assistant.knowledge_enabled
    ? await retrieveKnowledge(env, assistant.customer_id, assistant.id, knowledgeQuery, knowledgeBudget)
    : [];
  const assembledContext = assembleAssistantContext({
    businessInstructions: String(prompt?.instructions || ""),
    memory: conversationContext.memory,
    knowledgeSnippets: knowledge,
    tools: toolDescriptions,
    recentTurns: history.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    currentTurn: { text: input.userText, mediaContext: input.mediaContext },
    baseSystem: staticContext,
  });
  const system = assembledContext.system + (humanOpsEnabled
    ? `\n\nHUMAN REVIEW CONTROL: You may request a human decision only with the internal request_human_decision JSON action and only for these kinds: ${humanOpsKinds.join(", ")}. Never claim that payment, identity, partner status, or a protected action is verified before approval. When review is requested, the runtime sends the configured neutral acknowledgement.`
    : "");
  const estimatedInputTokens = Math.max(1, Math.ceil((system.length + history.reduce((n: number, m: any) => n + String(m.content || "").length, 0) + userCombined.length) / 4));
  const maxOutputTokens = selectCompletionBudget({ userText: input.userText });

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
  const routeRates = Array.isArray(route.__targets) && route.__targets.length ? route.__targets : [rate];
  const maxRoutedCalls = 3;
  const singleCallReserve = routeRates.reduce((sum: number, target: any) => {
    const inputRate = Math.ceil(Number(target?.input_credits_per_million || rate.input_credits_per_million || 0) * multiplierBps / 10000);
    const outputRate = Math.ceil(Number(target?.output_credits_per_million || rate.output_credits_per_million || 0) * multiplierBps / 10000);
    const reasoningRate = target?.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(target.reasoning_credits_per_million) * multiplierBps / 10000);
    return sum + Math.ceil((estimatedInputTokens * inputRate + maxOutputTokens * (outputRate + reasoningRate)) / 1_000_000);
  }, 0);
  const reserveAmount = Math.max(1, singleCallReserve * maxRoutedCalls);

  const singleCallProviderCostMicros = Math.max(0, routeRates.reduce((sum: number, target: any) => sum + Math.ceil(
    (estimatedInputTokens * Number(target?.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
      + maxOutputTokens * (Number(target?.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + Number(target?.provider_reasoning_cost_micros_per_million || 0))) / 1_000_000,
  ), 0));
  const estimatedProviderCostMicros = singleCallProviderCostMicros * maxRoutedCalls;
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(
    env.DB,
    assistant.customer_id,
    commercial,
    estimatedProviderCostMicros,
  ))) {
    return { ok: false as const, userMessage: "This assistant has reached its current usage limit. Please contact the account administrator." };
  }

  const reservation = await reserveCredits(env.DB, assistant.customer_id, assistant.id, reserveAmount, `reply-job:${input.replyJobId}`);
  if (!reservation) return { ok: false as const, userMessage: "This assistant has reached its current usage limit. Please contact the account administrator." };
  if (reservation.status === "released") {
    return { ok: false as const, userMessage: "This request’s prior credit reservation was released. Please send it again to start a new request." };
  }

  const completedAttempts: any[] = [];
  const journaledAttemptIds: string[] = [];
  let latestSuccessfulResult: any = null;
  let latestSuccessfulText = "";
  try {
    const aiInput = {
      messages: [
        { role: "system", content: system },
        ...assembledContext.history,
        { role: "user", content: assembledContext.userContent || "Please respond to the attached media." },
      ],
      max_tokens: maxOutputTokens,
      temperature: 0.4,
    };
    let result = await invokeJournaledProviderCall(env, route, aiInput, assistant.customer_id, assistant.id, input.replyJobId, reservation.id, 0, estimatedInputTokens, multiplierBps, journaledAttemptIds, normalizeReasoningMode(assistant.reasoning_mode) || "standard", normalizeReasoningFallbackPolicy(assistant.reasoning_fallback_policy) || "allow_lower_effort", conversationId);
    let text = extractAiText(result);
    latestSuccessfulResult = result;
    latestSuccessfulText = text;

    if (text && modelResponseWasTruncated(result)) {
      completedAttempts.push(...(Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : []));
      completedAttempts.push(routedResultAttempt(result, estimatedInputTokens, text));
      latestSuccessfulResult = null;
      const continuation = await invokeJournaledProviderCall(env, route, {
        messages: [
          ...aiInput.messages,
          { role: "assistant", content: text },
          { role: "user", content: "Continue exactly from where the previous reply stopped. Do not repeat earlier text." },
        ],
        max_tokens: maxOutputTokens,
        temperature: 0.2,
      }, assistant.customer_id, assistant.id, input.replyJobId, reservation.id, 1, estimatedInputTokens, multiplierBps, journaledAttemptIds, normalizeReasoningMode(assistant.reasoning_mode) || "standard", normalizeReasoningFallbackPolicy(assistant.reasoning_fallback_policy) || "allow_lower_effort", conversationId);
      const continuationText = extractAiText(continuation);
      latestSuccessfulResult = continuation;
      latestSuccessfulText = continuationText;
      if (continuationText) {
        text = (text.trimEnd() + " " + continuationText.trimStart()).trim();
        result = continuation;
      }
    }

    const humanRequest = humanOpsEnabled ? parseHumanDecisionCall(text,humanOpsKinds) : null;
    if (humanRequest) {
      const messageRows = await env.DB.prepare(
        `SELECT id FROM messages WHERE customer_id=? AND assistant_id=? AND conversation_id=? AND role='user'
         ORDER BY created_at DESC,id DESC LIMIT 10`,
      ).bind(assistant.customer_id,assistant.id,conversationId).all<any>();
      const evidenceMessageIds = (messageRows.results??[]).map((row:any)=>String(row.id));
      const request = await createHumanApprovalRequest(env.DB,{
        customerId:String(assistant.customer_id),assistantId:String(assistant.id),conversationId,
        requestedBy:`assistant:${assistant.id}`,kind:humanRequest.kind,question:humanRequest.question,summary:humanRequest.summary,
        proposedResponse:humanRequest.proposedResponse,evidenceMessageIds,
        idempotencyKey:`assistant:${input.replyJobId}:human-review`,now:unix(),expiresAt:unix()+86400,
      });
      if (request?.created) {
        await notifyHumanApprovalOwners(env,{customerId:String(assistant.customer_id),assistantId:String(assistant.id),approvalId:request.id,
          kind:humanRequest.kind,question:humanRequest.question,summary:humanRequest.summary,expiresAt:unix()+86400,now:unix()}).catch(()=>undefined);
        await notifyHumanOpsDestinations(env,{customerId:String(assistant.customer_id),assistantId:String(assistant.id),approvalId:request.id,
          kind:humanRequest.kind,question:humanRequest.question,summary:humanRequest.summary,expiresAt:unix()+86400,now:unix()}).catch(()=>undefined);
      }
      text = request?.status === "pending"
        ? String(humanOpsSetting?.human_acknowledgement||"Thanks, I have that. I’ll continue from here.").slice(0,600)
        : "I can’t verify that right now. Please contact the business directly for help.";
      latestSuccessfulText=text;
    }
    const toolCall = humanRequest ? null : parseToolCall(text, tools.results ?? []);
    if (toolCall) {
      const tool = (tools.results ?? []).find((t: any) => t.name === toolCall.tool);
      if (tool) {
        completedAttempts.push(...(Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : []));
        completedAttempts.push(routedResultAttempt(result, estimatedInputTokens, text));
        latestSuccessfulResult = null;
        const toolResult = await invokeTool(env, tool, toolCall.arguments);
        result = await invokeJournaledProviderCall(env, route, {
          messages: [
            ...aiInput.messages,
            { role: "assistant", content: text },
            { role: "user", content: `Tool result for ${tool.name}:\n${toolResult}\nNow answer the user normally.` },
          ],
          max_tokens: maxOutputTokens,
          temperature: 0.3,
        }, assistant.customer_id, assistant.id, input.replyJobId, reservation.id, 2, estimatedInputTokens, multiplierBps, journaledAttemptIds, normalizeReasoningMode(assistant.reasoning_mode) || "standard", normalizeReasoningFallbackPolicy(assistant.reasoning_fallback_policy) || "allow_lower_effort", conversationId);
        text = extractAiText(result);
        latestSuccessfulResult = result;
        latestSuccessfulText = text;
      }
    }

    if (!text) throw new Error("empty model response");
    const usage = extractUsage(result, estimatedInputTokens, text);
    const servedRate = result?.__mketyTargetRate || rate;
    const servedInputCredits = Math.ceil(Number(servedRate.input_credits_per_million || rate.input_credits_per_million || 0) * multiplierBps / 10000);
    const servedOutputCredits = Math.ceil(Number(servedRate.output_credits_per_million || rate.output_credits_per_million || 0) * multiplierBps / 10000);
    const servedReasoningCredits = servedRate.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(servedRate.reasoning_credits_per_million) * multiplierBps / 10000);
    const primaryCredits = Math.max(1, Math.ceil((usage.input * servedInputCredits + usage.output * servedOutputCredits + usage.reasoning * servedReasoningCredits) / 1_000_000));
    const providerCostMicros = Math.max(0, Math.ceil(
      (usage.input * Number(servedRate.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
        + usage.output * Number(servedRate.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + usage.reasoning * Number(servedRate.provider_reasoning_cost_micros_per_million || 0)) / 1_000_000
    ));
    const priorAttempts = [
      ...completedAttempts,
      ...(Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : []),
    ];
    const priorEconomics = priorAttempts.map((attempt: any) => ({
      attempt,
      ...modelAttemptEconomics(attempt, multiplierBps),
    }));
    const priorCredits = priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0);
    const actualCredits = Math.max(1, primaryCredits + priorCredits);
    await settleReservation(env.DB, reservation.id, assistant.customer_id, assistant.id, reserveAmount, actualCredits, {
      modelAlias: assistant.model_alias,
      provider: String(result?.__mketyProvider || route.provider),
      providerModel: String(result?.__mketyProviderModel || route.provider_model),
      conversationId,
      inputUnits: usage.input,
      outputUnits: usage.output,
      reasoningUnits: usage.reasoning,
      requestedReasoningMode: String(result?.__mketyRequestedReasoningMode || "standard"),
      appliedReasoningMode: String(result?.__mketyAppliedReasoningMode || "standard"),
      providerCostMicros,
      providerAttemptId: String(result?.__mketyAttemptId || `reservation:${reservation.id}`),
      primaryCredits,
      additionalProviderCosts: priorEconomics.map((item: any) => ({
        modelAlias: assistant.model_alias,
        provider: item.attempt.provider,
        providerModel: item.attempt.providerModel,
        inputUnits: item.attempt.inputUnits,
        outputUnits: item.attempt.outputUnits,
        reasoningUnits: Number(item.attempt.reasoningUnits || 0),
        requestedReasoningMode: String(item.attempt.requestedReasoningMode || "standard"),
        appliedReasoningMode: String(item.attempt.appliedReasoningMode || "standard"),
        costMicros: item.providerCostMicros,
        providerAttemptId: String(item.attempt.providerAttemptId || ""),
        creditsCharged: item.credits,
      })),
    });
    await Promise.all(journaledAttemptIds.map(async (attemptId) => {
      await settlementJournalStub(env.SETTLEMENT_JOURNAL, assistant.customer_id, assistant.id)
        .markAttemptSettled({ customerId: assistant.customer_id, assistantId: assistant.id, attemptId, settlementId: reservation.id });
      await updateAttemptProjection(env.DB, { customerId: assistant.customer_id, assistantId: assistant.id, attemptId, status: "settled", resolved: true });
    }));
    return { ok: true as const, text };
  } catch (error) {
    console.error("assistant inference failed", error);
    if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") {
      return {
        ok: false as const,
        retryable: true,
        retryAfterSeconds: error.retryAfterSeconds,
        error: error.message,
        userMessage: "I’m still working on that request and will reply as soon as the provider result is reconciled.",
      };
    }
    const priorAttempts = [
      ...completedAttempts,
      ...(Array.isArray((error as any)?.__mketyPriorAttempts) ? (error as any).__mketyPriorAttempts : []),
      ...(latestSuccessfulResult ? [routedResultAttempt(latestSuccessfulResult, estimatedInputTokens, latestSuccessfulText)] : []),
    ];
    const priorEconomics = priorAttempts.map((attempt: any) => ({
      attempt,
      ...modelAttemptEconomics(attempt, multiplierBps),
    }));
    const incurredCredits = priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0);
    const classified = classifyRetryableError(error);
    if (incurredCredits > 0 || priorEconomics.some((item: any) => item.providerCostMicros > 0)) {
      const first = priorEconomics[0];
        await settleReservation(env.DB, reservation.id, assistant.customer_id, assistant.id, reserveAmount, Math.min(reserveAmount, Math.max(1, incurredCredits)), {
        modelAlias: assistant.model_alias,
        provider: String(first?.attempt?.provider || route.provider),
        providerModel: String(first?.attempt?.providerModel || route.provider_model),
        conversationId,
        inputUnits: Number(first?.attempt?.inputUnits || 0),
        outputUnits: Number(first?.attempt?.outputUnits || 0),
        reasoningUnits: Number(first?.attempt?.reasoningUnits || 0),
        providerCostMicros: Number(first?.providerCostMicros || 0),
        providerAttemptId: String(first?.attempt?.providerAttemptId || `reservation:${reservation.id}`),
        primaryCredits: Number(first?.credits || 0),
        additionalProviderCosts: priorEconomics.slice(1).map((item: any) => ({
          modelAlias: assistant.model_alias,
          provider: item.attempt.provider,
          providerModel: item.attempt.providerModel,
          inputUnits: item.attempt.inputUnits,
          outputUnits: item.attempt.outputUnits,
          reasoningUnits: Number(item.attempt.reasoningUnits || 0),
          requestedReasoningMode: String(item.attempt.requestedReasoningMode || "standard"),
          appliedReasoningMode: String(item.attempt.appliedReasoningMode || "standard"),
          costMicros: item.providerCostMicros,
          providerAttemptId: String(item.attempt.providerAttemptId || ""),
          creditsCharged: item.credits,
        })),
      });
      await Promise.all(journaledAttemptIds.map((attemptId) => settlementJournalStub(env.SETTLEMENT_JOURNAL, assistant.customer_id, assistant.id)
        .markAttemptSettled({ customerId: assistant.customer_id, assistantId: assistant.id, attemptId, settlementId: reservation.id }).catch(() => undefined)));
      if (latestSuccessfulResult && latestSuccessfulText.trim()) {
        return { ok: true as const, text: latestSuccessfulText };
      }
    } else if (!classified.retryable) {
      await releaseReservation(env.DB, reservation.id, assistant.customer_id, reserveAmount);
    }
    return {
      ok: false as const,
      retryable: classified.retryable,
      retryAfterSeconds: classified.retryAfterSeconds,
      error: classified.message,
      userMessage: classified.retryable
        ? "I’m still working on that request and will reply as soon as capacity is available."
        : "I couldn’t complete that request just now. Please try again shortly.",
    };
  }
}

async function handleRawModelApiInference(
  request: Request,
  env: AssistEnv,
  customer: Customer,
  key: any,
  body: any,
  now: number,
): Promise<Response> {
  const setting = await env.DB.prepare(
    "SELECT enabled,allowed_models_json FROM raw_model_api_settings WHERE customer_id=? LIMIT 1",
  ).bind(customer.customerId).first<any>();
  let customerAllowlist: string[] = [];
  let keyAllowlist: string[] = [];
  try { customerAllowlist = normalizeModelAllowlist(setting?.allowed_models_json || "[]"); } catch {}
  try { keyAllowlist = normalizeModelAllowlist(key.model_allowlist_json || "[]"); } catch {}
  const alias = typeof body.model === "string" ? body.model.trim() : "";
  if (!canUseRawModelApi({ enabled: Number(setting?.enabled || 0) === 1, allowlist: customerAllowlist, alias }) || !keyAllowlist.includes(alias)) {
    return json({ error: { message: "model_not_allowed_for_api_key" } }, 403);
  }
  const route = await resolveModelRoute(env.DB, customer.customerId, alias);
  const rate = await env.DB.prepare(
    "SELECT * FROM model_rates WHERE alias=? AND effective_at<=? ORDER BY version DESC LIMIT 1",
  ).bind(alias, now).first<any>();
  if (!route || !rate) return json({ error: { message: "model_unavailable" } }, 503);

  const messages = Array.isArray(body.messages)
    ? body.messages.slice(-40).map((message: any) => ({
        role: ["system", "assistant", "user"].includes(String(message?.role)) ? String(message.role) : "user",
        content: typeof message?.content === "string" ? message.content.slice(0, 30000) : JSON.stringify(message?.content ?? "").slice(0, 30000),
      }))
    : [];
  if (!messages.length || !messages.some((message: any) => message.role === "user")) {
    return json({ error: { message: "messages_required" } }, 400);
  }
  const modelMessages = [
    { role: "system", content: "Do not disclose provider credentials, internal provider costs, private platform configuration, or other customers' information." },
    ...messages,
  ];
  const reasoningInput = body.reasoning_effort ?? body.reasoning_mode;
  const reasoningMode = reasoningInput == null ? "standard" : normalizeReasoningMode(reasoningInput);
  if (!reasoningMode) return json({ error: { message: "invalid_reasoning_mode" } }, 400);
  const inputChars = modelMessages.reduce((total: number, message: any) => total + String(message.content || "").length, 0);
  const estimatedInputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const lastUserText = String([...messages].reverse().find((message: any) => message.role === "user")?.content || "");
  const defaultOutputBudget = selectCompletionBudget({ userText: lastUserText });
  const requestedOutputBudget = body.max_tokens ?? body.max_completion_tokens;
  const maxOutputTokens = requestedOutputBudget == null
    ? defaultOutputBudget
    : Math.max(1, Math.min(2048, parseInt(String(requestedOutputBudget), 10) || defaultOutputBudget));
  const commercial = await env.DB.prepare(
    `SELECT cp.subscription_amount_minor,cp.provider_envelope_bps,cp.operations_reserve_bps,cp.rate_multiplier_bps,
            cp.hard_stop_enabled,c.billing_status,c.grace_until
     FROM commercial_policy cp JOIN customers c ON c.id=cp.customer_id WHERE cp.customer_id=? LIMIT 1`,
  ).bind(customer.customerId).first<any>();
  if (!commercial) return json({ error: { message: "commercial_policy_unavailable" } }, 503);
  if (commercial.billing_status === "past_due" && commercial.grace_until && now > Number(commercial.grace_until)) {
    return json({ error: { message: "billing_past_due" } }, 402);
  }
  const multiplierBps = Math.max(10000, Number(commercial.rate_multiplier_bps || 10000));
  const routeRates = Array.isArray(route.__targets) && route.__targets.length ? route.__targets : [rate];
  const reserveAmount = Math.max(1, routeRates.reduce((sum: number, target: any) => {
    const inputRate = Math.ceil(Number(target?.input_credits_per_million || rate.input_credits_per_million || 0) * multiplierBps / 10000);
    const outputRate = Math.ceil(Number(target?.output_credits_per_million || rate.output_credits_per_million || 0) * multiplierBps / 10000);
    const reasoningRate = target?.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(target.reasoning_credits_per_million) * multiplierBps / 10000);
    return sum + Math.ceil((estimatedInputTokens * inputRate + maxOutputTokens * (outputRate + reasoningRate)) / 1_000_000);
  }, 0));
  const estimatedProviderCostMicros = Math.max(0, routeRates.reduce((sum: number, target: any) => sum + Math.ceil(
    (estimatedInputTokens * Number(target?.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
      + maxOutputTokens * (Number(target?.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + Number(target?.provider_reasoning_cost_micros_per_million || 0))) / 1_000_000,
  ), 0));
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(env.DB, customer.customerId, commercial, estimatedProviderCostMicros))) {
    return json({ error: { message: "usage_limit_reached" } }, 402);
  }
  const suppliedKey = String(request.headers.get("idempotency-key") || "").trim().slice(0, 160);
  const requestId = suppliedKey ? `api:${key.id}:${suppliedKey}` : id("api");
  const reservation = await reserveRawModelCredits(env.DB, customer.customerId, String(key.id), reserveAmount, suppliedKey ? requestId : undefined);
  if (!reservation) return json({ error: { message: "insufficient_credits" } }, 402);
  if (reservation.status === "released") return json({ error: { message: "idempotent_request_reservation_released" } }, 409);

  const attemptIds: string[] = [];
  let providerResult: any = null;
  let providerText = "";
  const workload = { workloadType: "api_key" as const, workloadId: String(key.id) };
  try {
    const result = await invokeJournaledProviderCall(env, route, {
      messages: modelMessages, max_tokens: maxOutputTokens,
      temperature: typeof body.temperature === "number" ? Math.max(0, Math.min(2, body.temperature)) : 0.4,
    }, customer.customerId, "", requestId, reservation.id, 0, estimatedInputTokens, multiplierBps, attemptIds,
      reasoningMode, "allow_lower_effort", `api:${key.id}`, workload);
    providerResult = result;
    const text = extractAiText(result);
    providerText = text;
    if (!text) throw new Error("empty model response");
    const usage = extractUsage(result, estimatedInputTokens, text);
    const servedRate = result?.__mketyTargetRate || rate;
    const primaryCredits = Math.max(1, modelAttemptEconomics({ inputUnits: usage.input, outputUnits: usage.output,
      reasoningUnits: usage.reasoning, targetRate: { ...servedRate, rate_multiplier_bps: multiplierBps } }, multiplierBps).credits);
    const providerCostMicros = Math.max(0, Math.ceil(
      (usage.input * Number(servedRate.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
        + usage.output * Number(servedRate.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + usage.reasoning * Number(servedRate.provider_reasoning_cost_micros_per_million || 0)) / 1_000_000,
    ));
    const priorAttempts = Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : [];
    const priorEconomics = priorAttempts.map((attempt: any) => ({ attempt, ...modelAttemptEconomics(attempt, multiplierBps) }));
    const actualCredits = Math.min(reserveAmount, Math.max(1, primaryCredits + priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0)));
    const settled = await settleRawModelCredits(env.DB, reservation.id, customer.customerId, String(key.id), reserveAmount, actualCredits, {
      modelAlias: alias, provider: String(result?.__mketyProvider || route.provider),
      providerModel: String(result?.__mketyProviderModel || route.provider_model), conversationId: `api:${key.id}`,
      inputUnits: usage.input, outputUnits: usage.output, reasoningUnits: usage.reasoning,
      requestedReasoningMode: String(result?.__mketyRequestedReasoningMode || "standard"),
      appliedReasoningMode: String(result?.__mketyAppliedReasoningMode || "standard"), providerCostMicros,
      providerAttemptId: String(result?.__mketyAttemptId || `reservation:${reservation.id}`),
      additionalProviderCosts: priorEconomics.map((item: any) => ({
        provider: String(item.attempt.provider), providerModel: String(item.attempt.providerModel),
        inputUnits: Number(item.attempt.inputUnits || 0), outputUnits: Number(item.attempt.outputUnits || 0),
        reasoningUnits: Number(item.attempt.reasoningUnits || 0), providerCostMicros: item.providerCostMicros,
        providerAttemptId: String(item.attempt.providerAttemptId || ""),
      })),
    });
    if (!settled) throw new Error("raw_model_settlement_failed");
    await Promise.all(attemptIds.map(async (attemptId) => {
      const journal = settlementJournalStub(env.SETTLEMENT_JOURNAL, customer.customerId, String(key.id), "api_key");
      const identity = { customerId: customer.customerId, ...workload, attemptId };
      await journal.markAttemptSettled({ ...identity, settlementId: reservation.id });
      await updateAttemptProjection(env.DB, { ...identity, status: "settled", resolved: true });
    }));
    await env.DB.prepare("UPDATE customer_api_keys SET last_used_at=? WHERE id=? AND customer_id=?")
      .bind(now, key.id, customer.customerId).run();
    return json({
      id: `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`, object: "chat.completion", created: now, model: alias,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
      mkety: { credits_charged: actualCredits, workload_type: "api_key" },
    });
  } catch (error) {
    if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") {
      return json({ error: { message: error.message, retry_after_seconds: error.retryAfterSeconds } }, 503);
    }
    const classified = classifyRetryableError(error);
    const priorAttempts = Array.isArray((error as any)?.__mketyPriorAttempts) ? (error as any).__mketyPriorAttempts : [];
    if (providerResult) priorAttempts.push(routedResultAttempt(providerResult, estimatedInputTokens, providerText));
    const economics = priorAttempts.map((attempt: any) => ({ attempt, ...modelAttemptEconomics(attempt, multiplierBps) }));
    const incurred = economics.reduce((sum: number, item: any) => sum + item.credits, 0);
    if (economics.length && (incurred > 0 || economics.some((item: any) => item.providerCostMicros > 0))) {
      const first = economics[0];
      await settleRawModelCredits(env.DB, reservation.id, customer.customerId, String(key.id), reserveAmount,
        Math.min(reserveAmount, Math.max(1, incurred)), {
          modelAlias: alias, provider: String(first.attempt.provider || route.provider),
          providerModel: String(first.attempt.providerModel || route.provider_model), conversationId: `api:${key.id}`,
          inputUnits: Number(first.attempt.inputUnits || 0), outputUnits: Number(first.attempt.outputUnits || 0),
          reasoningUnits: Number(first.attempt.reasoningUnits || 0), providerCostMicros: first.providerCostMicros,
          providerAttemptId: String(first.attempt.providerAttemptId || `reservation:${reservation.id}`),
          additionalProviderCosts: economics.slice(1).map((item: any) => ({
            provider: String(item.attempt.provider), providerModel: String(item.attempt.providerModel),
            inputUnits: Number(item.attempt.inputUnits || 0), outputUnits: Number(item.attempt.outputUnits || 0),
            reasoningUnits: Number(item.attempt.reasoningUnits || 0), providerCostMicros: item.providerCostMicros,
            providerAttemptId: String(item.attempt.providerAttemptId || ""),
          })),
        });
      await Promise.all(attemptIds.map((attemptId) => {
        const journal = settlementJournalStub(env.SETTLEMENT_JOURNAL, customer.customerId, String(key.id), "api_key");
        return journal.markAttemptSettled({ customerId: customer.customerId, ...workload, attemptId, settlementId: reservation.id }).catch(() => undefined);
      }));
    } else if (!classified.retryable) {
      await releaseRawModelCredits(env.DB, reservation.id, customer.customerId, String(key.id));
    }
    console.error("Assist raw model API inference failed", error);
    if (classified.retryable) return new Response(JSON.stringify({ error: { message: "capacity_temporarily_unavailable", retry_after_seconds: classified.retryAfterSeconds } }), {
      status: 429, headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(classified.retryAfterSeconds) },
    });
    return json({ error: { message: "inference_failed" } }, 502);
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
  let keyMode: "assistant" | "raw_model";
  try { keyMode = normalizeApiKeyMode(key.mode); } catch { return json({ error: { message: "invalid_api_key" } }, 401); }
  if (keyMode === "raw_model") return handleRawModelApiInference(request, env, customer, key, body, now);
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
  const route = await resolveModelRoute(env.DB, customer.customerId, alias);
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
  const lastUserText = String([...messages].reverse().find((message: any) => message.role === "user")?.content || "");
  const defaultOutputBudget = selectCompletionBudget({ userText: lastUserText });
  const requestedOutputBudget = body.max_tokens ?? body.max_completion_tokens;
  const maxOutputTokens = requestedOutputBudget == null
    ? defaultOutputBudget
    : Math.max(1, Math.min(2048, parseInt(String(requestedOutputBudget), 10) || defaultOutputBudget));

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
  const routeRates = Array.isArray(route.__targets) && route.__targets.length ? route.__targets : [rate];
  const reserveAmount = Math.max(1, routeRates.reduce((sum: number, target: any) => {
    const inputRate = Math.ceil(Number(target?.input_credits_per_million || rate.input_credits_per_million || 0) * multiplierBps / 10000);
    const outputRate = Math.ceil(Number(target?.output_credits_per_million || rate.output_credits_per_million || 0) * multiplierBps / 10000);
    const reasoningRate = target?.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(target.reasoning_credits_per_million) * multiplierBps / 10000);
    return sum + Math.ceil((estimatedInputTokens * inputRate + maxOutputTokens * (outputRate + reasoningRate)) / 1_000_000);
  }, 0));
  const estimatedProviderCostMicros = Math.max(0, routeRates.reduce((sum: number, target: any) => sum + Math.ceil(
    (estimatedInputTokens * Number(target?.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
      + maxOutputTokens * (Number(target?.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + Number(target?.provider_reasoning_cost_micros_per_million || 0))) / 1_000_000,
  ), 0));
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(env.DB, customer.customerId, commercial, estimatedProviderCostMicros))) {
    return json({ error: { message: "usage_limit_reached" } }, 402);
  }

  const suppliedIdempotencyKey = String(request.headers.get("idempotency-key") || "").trim().slice(0, 160);
  const apiRequestId = suppliedIdempotencyKey ? `api:${key.id}:${suppliedIdempotencyKey}` : id("api");
  const reservation = await reserveCredits(
    env.DB, customer.customerId, assistantId, reserveAmount,
    suppliedIdempotencyKey ? apiRequestId : undefined,
  );
  if (!reservation) return json({ error: { message: "insufficient_credits" } }, 402);
  if (reservation.status === "released") return json({ error: { message: "idempotent_request_reservation_released" } }, 409);

  const apiJournaledAttemptIds: string[] = [];
  let apiProviderResult: any = null;
  let apiProviderText = "";
  try {
    const result = await invokeJournaledProviderCall(env, route, {
      messages: mergedMessages,
      max_tokens: maxOutputTokens,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
    }, customer.customerId, assistantId, apiRequestId, reservation.id, 0, estimatedInputTokens, multiplierBps, apiJournaledAttemptIds, normalizeReasoningMode(assistant.reasoning_mode) || "standard", normalizeReasoningFallbackPolicy(assistant.reasoning_fallback_policy) || "allow_lower_effort", `api:${key.id}`);
    apiProviderResult = result;
    const text = extractAiText(result);
    apiProviderText = text;
    if (!text) throw new Error("empty model response");
    const usage = extractUsage(result, estimatedInputTokens, text);
    const servedRate = result?.__mketyTargetRate || rate;
    const servedInputCredits = Math.ceil(Number(servedRate.input_credits_per_million || rate.input_credits_per_million || 0) * multiplierBps / 10000);
    const servedOutputCredits = Math.ceil(Number(servedRate.output_credits_per_million || rate.output_credits_per_million || 0) * multiplierBps / 10000);
    const servedReasoningCredits = servedRate.reasoning_credits_per_million == null ? 0 : Math.ceil(Number(servedRate.reasoning_credits_per_million) * multiplierBps / 10000);
    const primaryCredits = Math.max(1, Math.ceil(
      (usage.input * servedInputCredits + usage.output * servedOutputCredits + usage.reasoning * servedReasoningCredits) / 1_000_000,
    ));
    const providerCostMicros = Math.max(0, Math.ceil(
      (usage.input * Number(servedRate.provider_input_cost_micros_per_million || rate.provider_input_cost_micros_per_million || 0)
        + usage.output * Number(servedRate.provider_output_cost_micros_per_million || rate.provider_output_cost_micros_per_million || 0)
        + usage.reasoning * Number(servedRate.provider_reasoning_cost_micros_per_million || 0)) / 1_000_000,
    ));
    const priorAttempts = Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : [];
    const priorEconomics = priorAttempts.map((attempt: any) => ({ attempt, ...modelAttemptEconomics(attempt, multiplierBps) }));
    const actualCredits = Math.max(1, primaryCredits + priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0));
    await settleReservation(env.DB, reservation.id, customer.customerId, assistantId, reserveAmount, actualCredits, {
      modelAlias: alias,
      provider: String(result?.__mketyProvider || route.provider),
      providerModel: String(result?.__mketyProviderModel || route.provider_model),
      conversationId: `api:${key.id}`,
      inputUnits: usage.input,
      outputUnits: usage.output,
      reasoningUnits: usage.reasoning,
      requestedReasoningMode: String(result?.__mketyRequestedReasoningMode || "standard"),
      appliedReasoningMode: String(result?.__mketyAppliedReasoningMode || "standard"),
      providerCostMicros,
      providerAttemptId: String(result?.__mketyAttemptId || `reservation:${reservation.id}`),
      primaryCredits,
      apiKeyId: key.id,
      additionalProviderCosts: priorEconomics.map((item: any) => ({
        modelAlias: alias,
        provider: item.attempt.provider,
        providerModel: item.attempt.providerModel,
        inputUnits: item.attempt.inputUnits,
        outputUnits: item.attempt.outputUnits,
        reasoningUnits: Number(item.attempt.reasoningUnits || 0),
        requestedReasoningMode: String(item.attempt.requestedReasoningMode || "standard"),
        appliedReasoningMode: String(item.attempt.appliedReasoningMode || "standard"),
        costMicros: item.providerCostMicros,
        providerAttemptId: String(item.attempt.providerAttemptId || ""),
        creditsCharged: item.credits,
      })),
    });
    await Promise.all(apiJournaledAttemptIds.map(async (attemptId) => {
      await settlementJournalStub(env.SETTLEMENT_JOURNAL, customer.customerId, assistantId)
        .markAttemptSettled({ customerId: customer.customerId, assistantId, attemptId, settlementId: reservation.id });
      await updateAttemptProjection(env.DB, { customerId: customer.customerId, assistantId, attemptId, status: "settled", resolved: true });
    }));
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
    if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") {
      return json({ error: { message: error.message, retry_after_seconds: error.retryAfterSeconds } }, 503);
    }
    const classified = classifyRetryableError(error);
    const priorAttempts = Array.isArray((error as any)?.__mketyPriorAttempts) ? (error as any).__mketyPriorAttempts : [];
    if (apiProviderResult) priorAttempts.push(routedResultAttempt(apiProviderResult, estimatedInputTokens, apiProviderText));
    const priorEconomics = priorAttempts.map((attempt: any) => ({ attempt, ...modelAttemptEconomics(attempt, multiplierBps) }));
    const incurredCredits = priorEconomics.reduce((sum: number, item: any) => sum + item.credits, 0);
    if (priorEconomics.length && (incurredCredits > 0 || priorEconomics.some((item: any) => item.providerCostMicros > 0))) {
      const first = priorEconomics[0];
      await settleReservation(env.DB, reservation.id, customer.customerId, assistantId, reserveAmount, Math.min(reserveAmount, Math.max(1, incurredCredits)), {
        modelAlias: alias,
        provider: String(first?.attempt?.provider || route.provider),
        providerModel: String(first?.attempt?.providerModel || route.provider_model),
        conversationId: `api:${key.id}`,
        inputUnits: Number(first?.attempt?.inputUnits || 0),
        outputUnits: Number(first?.attempt?.outputUnits || 0),
        reasoningUnits: Number(first?.attempt?.reasoningUnits || 0),
        providerCostMicros: Number(first?.providerCostMicros || 0),
        primaryCredits: Number(first?.credits || 0),
        apiKeyId: key.id,
        additionalProviderCosts: priorEconomics.slice(1).map((item: any) => ({
          modelAlias: alias,
          provider: item.attempt.provider,
          providerModel: item.attempt.providerModel,
          inputUnits: item.attempt.inputUnits,
          outputUnits: item.attempt.outputUnits,
          reasoningUnits: Number(item.attempt.reasoningUnits || 0),
          requestedReasoningMode: String(item.attempt.requestedReasoningMode || "standard"),
          appliedReasoningMode: String(item.attempt.appliedReasoningMode || "standard"),
          costMicros: item.providerCostMicros,
          providerAttemptId: String(item.attempt.providerAttemptId || ""),
          creditsCharged: item.credits,
        })),
      });
      await Promise.all(apiJournaledAttemptIds.map((attemptId) => settlementJournalStub(env.SETTLEMENT_JOURNAL, customer.customerId, assistantId)
        .markAttemptSettled({ customerId: customer.customerId, assistantId, attemptId, settlementId: reservation.id }).catch(() => undefined)));
    } else if (!classified.retryable) {
      await releaseReservation(env.DB, reservation.id, customer.customerId, reserveAmount);
    }
    console.error("Assist API inference failed", error);
    if (classified.retryable) {
      return new Response(JSON.stringify({
        error: {
          message: "capacity_temporarily_unavailable",
          retry_after_seconds: classified.retryAfterSeconds,
        },
      }), {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(classified.retryAfterSeconds),
        },
      });
    }
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
      const mediaRequestId = `${conversationId}:telegram-message:${String(message.message_id || "unknown")}`;
      const vision = await describeImage(env, assistant, asset.bytes, text, asset.meta.mime, conversationId, mediaRequestId);
      if (vision.text) {
        contexts.push(`Attached image analysis for this same customer message:\n${vision.text}`);
        await env.DB.prepare("UPDATE media_assets SET vision_text=? WHERE id=?").bind(vision.text, asset.id).run();
      } else {
        contexts.push("[An image was attached, but image understanding failed. Do not claim to have seen or read the image; ask the customer to resend it or try again.]");
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
      const mediaRequestId = `${conversationId}:telegram-message:${String(message.message_id || "unknown")}`;
      const transcript = await transcribeAudio(env, assistant, asset.bytes, asset.meta.mime, audioSeconds, conversationId, mediaRequestId);
      if (transcript.text) {
        contexts.push(`Voice transcript for this same customer message:\n${transcript.text}`);
        await env.DB.prepare("UPDATE media_assets SET transcript=? WHERE id=?").bind(transcript.text, asset.id).run();
      } else {
        contexts.push("[A voice message was attached, but transcription failed. Do not invent what was said; ask the customer to resend the voice note or type the message.]");
      }
    }
  }

  return { text, mediaContext: contexts.join("\n"), mediaJson, mediaUsage: [], imageCount, audioSeconds };
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


async function mediaRouteTargets(db: D1Database, customerId: string, alias: "mkety-media-vision" | "mkety-media-speech") {
  const route = await resolveModelRoute(db, customerId, alias);
  if (!route) return [];
  const configured = Array.isArray(route.__targets) && route.__targets.length
    ? route.__targets
    : [
        { position: 0, provider: route.provider, provider_model: route.provider_model, provider_connection_id: route.provider_connection_id },
        ...(route.fallback_provider && route.fallback_model
          ? [{ position: 1, provider: route.fallback_provider, provider_model: route.fallback_model, provider_connection_id: route.fallback_provider_connection_id }]
          : []),
      ];
  const usable: any[] = [];
  for (const target of configured) {
    if (!target?.provider || !target?.provider_model || !routeTargetMediaSupported(target, alias) || !routeTargetPricingConfigured(target, alias)) continue;
    if (["workers-ai", "mkety-managed"].includes(String(target.provider))) {
      usable.push(target);
      continue;
    }
    const connection = target.provider_connection_id
      ? await db.prepare("SELECT provider,status,validated_at,ownership,customer_id FROM provider_connections WHERE id=? LIMIT 1").bind(target.provider_connection_id).first<any>()
      : null;
    if (!connection || connection.provider !== target.provider || connection.status !== "active" || !connection.validated_at) continue;
    if (connection.ownership === "customer" && connection.customer_id !== customerId) continue;
    usable.push(target);
  }
  return usable;
}

async function mediaProviderConnection(env: AssistEnv, target: any, customerId: string) {
  if (!target.provider_connection_id) throw new Error("media_provider_connection_required");
  const row = await env.DB.prepare(
    "SELECT provider,endpoint_url,api_key_ciphertext,extra_json,status,ownership,customer_id,validated_at FROM provider_connections WHERE id=? LIMIT 1",
  ).bind(target.provider_connection_id).first<any>();
  if (!row || row.status !== "active" || !row.validated_at) throw new Error("media_provider_unavailable");
  if (String(row.provider) !== String(target.provider)) throw new Error("media_provider_connection_mismatch");
  if (row.ownership === "customer" && row.customer_id !== customerId) throw new Error("media_provider_customer_scope_mismatch");
  return {
    ...row,
    apiKey: await revealSecret(String(row.api_key_ciphertext), env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY),
    extra: row.extra_json ? JSON.parse(String(row.extra_json)) : {},
  };
}

function responseApiText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (Array.isArray(payload?.output) ? payload.output : [])
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

function mediaTargetUsage(target: any, kind: "vision" | "speech", inputUnits: number, outputUnits: number, audioSeconds = 0) {
  return {
    kind,
    modelAlias: kind === "vision" ? "mkety-media-vision" : "mkety-media-speech",
    conversationId: "",
    provider: String(target.provider),
    providerModel: String(target.provider_model),
    inputUnits: Math.max(0, Math.ceil(Number(inputUnits || 0))),
    outputUnits: Math.max(0, Math.ceil(Number(outputUnits || 0))),
    audioSeconds: Math.max(0, Number(audioSeconds || 0)),
    rate: {
      inputCreditsPerMillion: Number(target.input_credits_per_million || 0),
      outputCreditsPerMillion: Number(target.output_credits_per_million || 0),
      imageCredits: Number(target.image_credits || 0),
      audioCreditsPerMinute: Number(target.audio_credits_per_minute || 0),
      providerInputCostMicrosPerMillion: Number(target.provider_input_cost_micros_per_million || 0),
      providerOutputCostMicrosPerMillion: Number(target.provider_output_cost_micros_per_million || 0),
      providerImageCostMicros: Number(target.provider_image_cost_micros || 0),
      providerAudioCostMicrosPerMinute: Number(target.provider_audio_cost_micros_per_minute || 0),
    },
  };
}


async function mediaCommercialState(db: D1Database, customerId: string) {
  return db.prepare(
    `SELECT cp.subscription_amount_minor,cp.provider_envelope_bps,cp.operations_reserve_bps,cp.rate_multiplier_bps,
            cp.hard_stop_enabled,c.billing_status,c.grace_until
     FROM commercial_policy cp JOIN customers c ON c.id=cp.customer_id
     WHERE cp.customer_id=? LIMIT 1`,
  ).bind(customerId).first<any>();
}

function mediaUsageEconomics(usage: any, multiplierBps: number) {
  const rate = usage?.rate || {};
  if (usage?.kind === "speech") {
    const customerRate = Math.ceil(Number(rate.audioCreditsPerMinute || 0) * multiplierBps / 10000);
    const credits = Math.max(1, Math.ceil((Number(usage.audioSeconds || 0) / 60) * customerRate));
    const providerCostMicros = Math.max(0, Math.ceil(
      (Number(usage.audioSeconds || 0) / 60) * Number(rate.providerAudioCostMicrosPerMinute || 0),
    ));
    return { credits, providerCostMicros };
  }
  const inputRate = Math.ceil(Number(rate.inputCreditsPerMillion || 0) * multiplierBps / 10000);
  const outputRate = Math.ceil(Number(rate.outputCreditsPerMillion || 0) * multiplierBps / 10000);
  const fixedImageCredits = Math.ceil(Number(rate.imageCredits || 0) * multiplierBps / 10000);
  const credits = Math.max(1, fixedImageCredits + Math.ceil(
    (Number(usage.inputUnits || 0) * inputRate + Number(usage.outputUnits || 0) * outputRate) / 1_000_000,
  ));
  const providerCostMicros = Math.max(0,
    Number(rate.providerImageCostMicros || 0)
    + Math.ceil((
      Number(usage.inputUnits || 0) * Number(rate.providerInputCostMicrosPerMillion || 0)
      + Number(usage.outputUnits || 0) * Number(rate.providerOutputCostMicrosPerMillion || 0)
    ) / 1_000_000),
  );
  return { credits, providerCostMicros };
}

async function reserveMediaUsage(
  env: AssistEnv,
  assistant: any,
  conversationId: string,
  usage: any,
  idempotencyKey: string,
) {
  const commercial = await mediaCommercialState(env.DB, assistant.customer_id);
  if (!commercial) return null;
  if (commercial.billing_status === "past_due" && commercial.grace_until && unix() > Number(commercial.grace_until)) return null;
  const multiplierBps = Math.max(10000, Number(commercial.rate_multiplier_bps || 10000));
  const economics = mediaUsageEconomics(usage, multiplierBps);
  if (commercial.hard_stop_enabled && !(await providerBudgetAllows(
    env.DB,
    assistant.customer_id,
    commercial,
    economics.providerCostMicros,
  ))) return null;
  const reservation = await reserveCredits(env.DB, assistant.customer_id, assistant.id, economics.credits, idempotencyKey);
  if (!reservation || reservation.status === "released") return null;
  return { reservation, commercial, multiplierBps, economics, conversationId };
}

async function settleMediaUsage(
  env: AssistEnv,
  assistant: any,
  reserved: any,
  usage: any,
  providerAttemptId: string,
) {
  const actual = mediaUsageEconomics(usage, reserved.multiplierBps);
  return settleReservation(
    env.DB,
    reserved.reservation.id,
    assistant.customer_id,
    assistant.id,
    reserved.economics.credits,
    actual.credits,
    {
      modelAlias: String(usage.modelAlias),
      provider: String(usage.provider),
      providerModel: String(usage.providerModel),
      conversationId: String(reserved.conversationId),
      inputUnits: Number(usage.inputUnits || 0),
      outputUnits: Number(usage.outputUnits || 0),
      providerCostMicros: actual.providerCostMicros,
      providerAttemptId,
    },
  );
}

async function invokeJournaledMediaAttempt(
  env: AssistEnv,
  assistant: any,
  target: any,
  requestId: string,
  reservationId: string,
  sourceHash: string,
  ordinal: number,
  estimatedUsage: any,
  multiplierBps: number,
  invoke: (markSubmitted: () => void) => Promise<{ text: string; inputUnits: number; outputUnits: number }>,
) {
  const replyJobId = `media:${requestId}:${sourceHash}:${ordinal}`;
  const attemptId = attemptIdFor(replyJobId, reservationId, 0);
  const identity = { customerId: assistant.customer_id, assistantId: assistant.id, attemptId };
  const journal = settlementJournalStub(env.SETTLEMENT_JOURNAL, assistant.customer_id, assistant.id);
  const requestHash = await resilienceSha256Text(JSON.stringify({ sourceHash, target: target.provider_model, kind: estimatedUsage.kind }));
  const rateSnapshot = Object.fromEntries([
    "input_credits_per_million", "output_credits_per_million", "reasoning_credits_per_million",
    "provider_input_cost_micros_per_million", "provider_output_cost_micros_per_million",
    "provider_reasoning_cost_micros_per_million", "image_credits", "audio_credits_per_minute",
    "provider_image_cost_micros", "provider_audio_cost_micros_per_minute", "rate_multiplier_bps",
  ].filter((key) => target[key] != null).map((key) => [key, Number(target[key])]));
  await recordAttemptProjection(env.DB, {
    ...identity, reservationId, requestHash, modelAlias: String(estimatedUsage.alias || (estimatedUsage.kind === "vision" ? "mkety-media-vision" : "mkety-media-speech")),
    replyJobId, conversationId: String(estimatedUsage.conversationId || ""), mediaKind: String(estimatedUsage.kind || "media"),
    provider: String(target.provider || "unknown"), model: String(target.provider_model || "unknown"),
    rateSnapshot: { ...rateSnapshot, rate_multiplier_bps: multiplierBps },
  });
  const claim = await journal.claimAttempt({
    ...identity, reservationId, requestHash,
    provider: String(target.provider || "unknown"), model: String(target.provider_model || "unknown"),
    idempotencyKey: attemptId, startedAt: unix(),
  });
  const existing = claim.attempt;
  if (existing.status === "result_recorded" || existing.status === "settled") {
    if (!existing.result) throw new Error("media_journal_result_missing");
    let usage: any = estimatedUsage;
    try { usage = { ...estimatedUsage, ...JSON.parse(String(existing.result.metadata?.usageJson || "{}")) }; } catch {}
    await updateAttemptProjection(env.DB, {
      ...identity, status: existing.status === "settled" ? "settled" : "result_recorded",
      inputUnits: existing.result.inputUnits, outputUnits: existing.result.outputUnits,
      imageUnits: estimatedUsage.kind === "vision" ? 1 : null, audioSeconds: estimatedUsage.kind === "speech" ? Number(usage.audioSeconds || 0) : null,
      providerCostMicros: existing.result.providerCostMicros, rateSnapshot: { ...rateSnapshot, rate_multiplier_bps: multiplierBps },
    });
    return { output: { text: existing.result.responseText, inputUnits: existing.result.inputUnits, outputUnits: existing.result.outputUnits }, usage, attemptId };
  }
  if (existing.status === "unknown_outcome") throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
  if (!claim.claimed) {
    if (existing.status === "started" && Date.now() - existing.updatedAt > 5 * 60_000) await journal.markAttemptUnknown(identity);
    throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
  }
  let providerSubmitted = false;
  try {
    const output = await invoke(() => { providerSubmitted = true; });
    const usage = { ...estimatedUsage, inputUnits: output.inputUnits, outputUnits: output.outputUnits };
    const economics = mediaUsageEconomics(usage, multiplierBps);
    await journal.recordAttemptResult(identity, {
      responseText: output.text,
      inputUnits: output.inputUnits,
      outputUnits: output.outputUnits,
      providerCostMicros: economics.providerCostMicros,
      credits: economics.credits,
      metadata: { usageJson: JSON.stringify(usage) },
    });
    await updateAttemptProjection(env.DB, {
      ...identity, status: "result_recorded", inputUnits: output.inputUnits, outputUnits: output.outputUnits,
      imageUnits: usage.kind === "vision" ? 1 : null, audioSeconds: usage.kind === "speech" ? Number(usage.audioSeconds || 0) : null,
      providerCostMicros: economics.providerCostMicros, rateSnapshot: { ...rateSnapshot, rate_multiplier_bps: multiplierBps },
    });
    return { output, usage, attemptId };
  } catch (error) {
    if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") throw error;
    if (providerSubmitted || Boolean((error as any)?.__mketyProviderAttempted)) {
      await journal.markAttemptUnknown(identity).catch(() => undefined);
      await updateAttemptProjection(env.DB, { ...identity, status: "unknown_outcome" }).catch(() => undefined);
      throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
    }
    await journal.markAttemptNotSubmitted(identity).catch(() => undefined);
    await updateAttemptProjection(env.DB, { ...identity, status: "not_submitted", resolved: true }).catch(() => undefined);
    throw error;
  }
}

async function invokeVisionTarget(
  env: AssistEnv,
  target: any,
  customerId: string,
  bytes: ArrayBuffer,
  mime: string,
  caption: string,
  markSubmitted: () => void = () => undefined,
) {
  const provider = String(target.provider);
  const model = String(target.provider_model);
  const b64 = arrayBufferToBase64(bytes);
  const prompt = [
    "Analyze the attached image as visual evidence for another assistant.",
    "Do not answer the customer's business question yourself.",
    "Describe the important visible objects, UI states, account/status indicators, numbers, names and readable text accurately.",
    "If text is unclear, say it is unclear instead of inventing it.",
    caption ? `Customer caption/question for context: ${caption}` : "There is no customer caption.",
    "Return only a concise factual image analysis that the final assistant can use together with the customer's caption/question.",
  ].join("\n");
  const estimatedInput = Math.max(1, Math.ceil(prompt.length / 4));

  if (provider === "workers-ai" || provider === "mkety-managed") {
    markSubmitted();
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: "Describe the attached image accurately and concisely for another assistant. Do not invent unreadable text." },
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${b64}` } },
        ] },
      ],
      max_completion_tokens: 768,
      reasoning_effort: "low",
    });
    const text = extractAiText(result);
    const usage = extractUsage(result, estimatedInput, text);
    return { text, inputUnits: usage.input, outputUnits: usage.output };
  }

  const connection = await mediaProviderConnection(env, target, customerId);

  if (provider === "vertex") {
    const service = await vertexAccessTokenFromServiceAccount(connection.apiKey);
    const projectId = String(connection.extra.projectId || service.projectId || "").trim();
    const location = String(connection.extra.location || "global").trim();
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    markSubmitted();
    const response = await fetch(
      `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${service.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: prompt },
            { inlineData: { mimeType: mime || "image/jpeg", data: b64 } },
          ] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0 },
        }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = String(payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
    return {
      text,
      inputUnits: Number(payload.usageMetadata?.promptTokenCount || estimatedInput),
      outputUnits: Number(payload.usageMetadata?.candidatesTokenCount || Math.max(1, Math.ceil(text.length / 4))),
    };
  }

  if (provider === "gemini") {
    const base = String(connection.endpoint_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"");
    markSubmitted();
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(connection.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType: mime || "image/jpeg", data: b64 } },
        ] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0 },
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = String(payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
    return {
      text,
      inputUnits: Number(payload.usageMetadata?.promptTokenCount || estimatedInput),
      outputUnits: Number(payload.usageMetadata?.candidatesTokenCount || Math.max(1, Math.ceil(text.length / 4))),
    };
  }

  if (provider === "azure-foundry" || provider === "openai") {
    const base = provider === "openai"
      ? String(connection.endpoint_url || "https://api.openai.com/v1").replace(/\/$/,"")
      : String(connection.endpoint_url || "").replace(/\/$/,"");
    if (!base) throw new Error("media_frontier_endpoint_missing");
    const url = provider === "openai"
      ? `${base}/responses`
      : (/\/openai\/v1\/responses$/i.test(base) ? base : `${base}/openai/v1/responses`);
    markSubmitted();
    const response = await fetch(url, {
      method: "POST",
      headers: provider === "openai"
        ? { authorization: `Bearer ${connection.apiKey}`, "content-type": "application/json" }
        : { "api-key": connection.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mime || "image/jpeg"};base64,${b64}`, detail: "auto" },
        ] }],
        max_output_tokens: 500,
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = responseApiText(payload);
    return {
      text,
      inputUnits: Number(payload.usage?.input_tokens || estimatedInput),
      outputUnits: Number(payload.usage?.output_tokens || Math.max(1, Math.ceil(text.length / 4))),
    };
  }

  if (provider === "azure-openai") {
    const endpoint = String(connection.endpoint_url || "").replace(/\/$/,"");
    if (!endpoint) throw new Error("azure_openai_endpoint_missing");
    const apiVersion = String(connection.extra.apiVersion || "2024-10-21");
    markSubmitted();
    const response = await fetch(
      `${endpoint}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: "POST",
        headers: { "api-key": connection.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${b64}` } },
          ] }],
          max_tokens: 500,
          temperature: 0,
        }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = extractAiText(payload);
    return {
      text,
      inputUnits: Number(payload.usage?.prompt_tokens || estimatedInput),
      outputUnits: Number(payload.usage?.completion_tokens || Math.max(1, Math.ceil(text.length / 4))),
    };
  }

  throw new Error(`media_vision_provider_unsupported:${provider}`);
}

function audioResponseText(result: any) {
  const direct = String(result?.text || result?.transcript || "").trim();
  if (direct) return direct;
  const channels = result?.results?.channels;
  if (Array.isArray(channels)) {
    return channels.flatMap((channel: any) => channel?.alternatives || [])
      .map((alt: any) => String(alt?.transcript || ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

async function invokeSpeechTarget(
  env: AssistEnv,
  target: any,
  customerId: string,
  bytes: ArrayBuffer,
  mime: string,
  markSubmitted: () => void = () => undefined,
) {
  const provider = String(target.provider);
  const model = String(target.provider_model);
  const b64 = arrayBufferToBase64(bytes);

  if (provider === "workers-ai" || provider === "mkety-managed") {
    const workersInput = model === "@cf/openai/whisper"
      ? { audio: [...new Uint8Array(bytes)] }
      : { audio: b64 };
    markSubmitted();
    const result = await env.AI.run(model, workersInput);
    return audioResponseText(result);
  }

  const connection = await mediaProviderConnection(env, target, customerId);

  if (provider === "vertex") {
    const service = await vertexAccessTokenFromServiceAccount(connection.apiKey);
    const projectId = String(connection.extra.projectId || service.projectId || "").trim();
    const location = String(connection.extra.location || "global").trim();
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    markSubmitted();
    const response = await fetch(
      `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${service.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: "Transcribe this audio accurately. Return only the transcript." },
            { inlineData: { mimeType: mime || "audio/ogg", data: b64 } },
          ] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0 },
        }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = String(payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
    return text;
  }

  if (provider === "gemini") {
    const base = String(connection.endpoint_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"");
    markSubmitted();
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(connection.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: "Transcribe this audio accurately. Return only the transcript." },
          { inlineData: { mimeType: mime || "audio/ogg", data: b64 } },
        ] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0 },
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const text = String(payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
    return text;
  }

  if (provider === "azure-foundry" || provider === "openai") {
    const normalizedMime = String(mime || "").toLowerCase();
    const format = normalizedMime.includes("wav") ? "wav" : normalizedMime.includes("mpeg") || normalizedMime.includes("mp3") ? "mp3" : null;
    if (!format) throw new Error("responses_audio_requires_mp3_or_wav");
    const base = provider === "openai"
      ? String(connection.endpoint_url || "https://api.openai.com/v1").replace(/\/$/,"")
      : String(connection.endpoint_url || "").replace(/\/$/,"");
    if (!base) throw new Error("media_frontier_endpoint_missing");
    const url = provider === "openai" ? `${base}/responses` : (/\/openai\/v1\/responses$/i.test(base) ? base : `${base}/openai/v1/responses`);
    markSubmitted();
    const response = await fetch(url, {
      method: "POST",
      headers: provider === "openai"
        ? { authorization: `Bearer ${connection.apiKey}`, "content-type": "application/json" }
        : { "api-key": connection.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Transcribe this audio accurately. Return only the transcript." },
          { type: "input_audio", input_audio: { data: b64, format } },
        ] }],
        max_output_tokens: 2048,
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    return responseApiText(payload);
  }

  throw new Error(`media_speech_provider_unsupported:${provider}`);
}

async function describeImage(
  env: AssistEnv,
  assistant: any,
  bytes: ArrayBuffer,
  caption: string,
  mime = "image/jpeg",
  conversationId = "",
  requestId = conversationId,
) {
  const mediaHash = hex(await digestSha256(new Uint8Array(bytes)));
  const sourceHash = await resilienceSha256Text(mediaHash + ":" + String(caption || "").trim());
  const cacheKey = `vision:${assistant.id}:${sourceHash}`;
  const cached = await getPromptCache(env.DB, cacheKey, sourceHash);
  if (cached) return { text: cached, usage: null };

  const targets = await mediaRouteTargets(env.DB, assistant.customer_id, "mkety-media-vision");
  for (const [ordinal, target] of targets.entries()) {
    const reserveEstimate = mediaTargetUsage(target, "vision", 65536, 500);
    reserveEstimate.conversationId = conversationId;
    const reservationKey = `media:${await resilienceSha256Text(`${requestId}:${sourceHash}:vision:${ordinal}:${target.provider}:${target.provider_model}`)}`;
    const reserved = await reserveMediaUsage(env, assistant, conversationId, reserveEstimate, reservationKey);
    if (!reserved) {
      console.warn("vision target skipped because media budget or customer credits are unavailable", {
        provider: target.provider, model: target.provider_model,
      });
      continue;
    }
    let journaled: any = null;
    try {
      journaled = await invokeJournaledMediaAttempt(
        env, assistant, target, requestId, reserved.reservation.id, sourceHash, ordinal,
        reserveEstimate, reserved.multiplierBps,
        (markSubmitted) => invokeVisionTarget(env, target, assistant.customer_id, bytes, mime, caption, markSubmitted),
      );
      const output = journaled.output;
      const text = String(output.text || "").trim();
      const actualUsage = { ...reserveEstimate, ...journaled.usage };
      const settled = await settleMediaUsage(env, assistant, reserved, actualUsage, journaled.attemptId);
      if (!settled) throw new Error("media_vision_settlement_failed");
      await settlementJournalStub(env.SETTLEMENT_JOURNAL, assistant.customer_id, assistant.id)
        .markAttemptSettled({ customerId: assistant.customer_id, assistantId: assistant.id, attemptId: journaled.attemptId, settlementId: reserved.reservation.id });
      await updateAttemptProjection(env.DB, { customerId: assistant.customer_id, assistantId: assistant.id, attemptId: journaled.attemptId, status: "settled", resolved: true });
      if (!text) {
        console.warn("vision provider returned an empty response; trying the next capability fallback");
        continue;
      }
      await putPromptCache({
        db: env.DB, cacheKey, customerId: assistant.customer_id, assistantId: assistant.id,
        kind: "vision", value: text, sourceHash, ttlSeconds: 2592000,
      }).catch(() => undefined);
      return { text, usage: null };
    } catch (error) {
      if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") throw error;
      if (journaled) throw new RetryableInferenceError("provider_settlement_pending", 60);
      await releaseReservation(
        env.DB,
        reserved.reservation.id,
        assistant.customer_id,
        reserved.economics.credits,
      ).catch(() => undefined);
      console.warn("vision target failed; trying next capability fallback", {
        provider: target.provider, model: target.provider_model,
        error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      });
    }
  }
  console.error("vision extraction failed: no capability route target succeeded");
  return { text: "", usage: null };
}

async function transcribeAudio(
  env: AssistEnv,
  assistant: any,
  bytes: ArrayBuffer,
  mime = "audio/ogg",
  audioSeconds = 0,
  conversationId = "",
  requestId = conversationId,
) {
  const sourceHash = hex(await digestSha256(new Uint8Array(bytes)));
  const cacheKey = `audio:${assistant.id}:${sourceHash}`;
  const cached = await getPromptCache(env.DB, cacheKey, sourceHash);
  if (cached) return { text: cached, usage: null };

  const targets = await mediaRouteTargets(env.DB, assistant.customer_id, "mkety-media-speech");
  for (const [ordinal, target] of targets.entries()) {
    const reserveEstimate = mediaTargetUsage(target, "speech", 0, 0, audioSeconds);
    reserveEstimate.conversationId = conversationId;
    const reservationKey = `media:${await resilienceSha256Text(`${requestId}:${sourceHash}:speech:${ordinal}:${target.provider}:${target.provider_model}`)}`;
    const reserved = await reserveMediaUsage(env, assistant, conversationId, reserveEstimate, reservationKey);
    if (!reserved) {
      console.warn("speech target skipped because media budget or customer credits are unavailable", {
        provider: target.provider, model: target.provider_model,
      });
      continue;
    }
    let journaled: any = null;
    try {
      journaled = await invokeJournaledMediaAttempt(
        env, assistant, target, requestId, reserved.reservation.id, sourceHash, ordinal,
        reserveEstimate, reserved.multiplierBps,
        async (markSubmitted) => ({ text: await invokeSpeechTarget(env, target, assistant.customer_id, bytes, mime, markSubmitted), inputUnits: 0, outputUnits: 0 }),
      );
      const text = String(journaled.output.text || "").trim();
      const actualUsage = { ...reserveEstimate, ...journaled.usage };
      const settled = await settleMediaUsage(env, assistant, reserved, actualUsage, journaled.attemptId);
      if (!settled) throw new Error("media_speech_settlement_failed");
      await settlementJournalStub(env.SETTLEMENT_JOURNAL, assistant.customer_id, assistant.id)
        .markAttemptSettled({ customerId: assistant.customer_id, assistantId: assistant.id, attemptId: journaled.attemptId, settlementId: reserved.reservation.id });
      await updateAttemptProjection(env.DB, { customerId: assistant.customer_id, assistantId: assistant.id, attemptId: journaled.attemptId, status: "settled", resolved: true });
      if (!text) {
        console.warn("speech provider returned an empty transcript; trying the next capability fallback");
        continue;
      }
      await putPromptCache({
        db: env.DB, cacheKey, customerId: assistant.customer_id, assistantId: assistant.id,
        kind: "audio", value: text, sourceHash, ttlSeconds: 2592000,
      }).catch(() => undefined);
      return { text, usage: null };
    } catch (error) {
      if (error instanceof RetryableInferenceError && error.message === "provider_attempt_reconciliation_required") throw error;
      if (journaled) throw new RetryableInferenceError("provider_settlement_pending", 60);
      await releaseReservation(
        env.DB,
        reserved.reservation.id,
        assistant.customer_id,
        reserved.economics.credits,
      ).catch(() => undefined);
      console.warn("speech target failed; trying next capability fallback", {
        provider: target.provider, model: target.provider_model,
        error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      });
    }
  }
  console.error("audio transcription failed: no capability route target succeeded");
  return { text: "", usage: null };
}

async function retrieveKnowledge(
  env: AssistEnv,
  customerId: string,
  assistantId: string,
  query: string,
  charBudget: number,
) {
  const db = env.DB;
  const terms = Array.from(new Set(String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3))).slice(0, 10);
  if (!terms.length) return [];
  const normalizedQuery = terms.join(" ");
  let manifest: any[];
  try {
    const versionRows = await db.prepare(
      `SELECT ak.collection_id,ki.id AS item_id,ki.updated_at,ki.status
       FROM assistant_knowledge ak
       LEFT JOIN knowledge_items ki ON ki.collection_id=ak.collection_id AND ki.customer_id=?
       WHERE ak.assistant_id=? ORDER BY ak.collection_id,ki.id`,
    ).bind(customerId, assistantId).all<any>();
    manifest = versionRows.results ?? [];
  } catch {
    // Without a live source version, no cached business facts can be trusted.
    return [];
  }
  const sourceVersion = await resilienceSha256Text(JSON.stringify({ manifest, normalizedQuery, charBudget }));
  const snapshotIdentity = {
    customerId, assistantId, kind: "knowledge_retrieval" as const, sourceVersion,
  };
  const snapshotKey = contextCacheKey(snapshotIdentity);
  const snapshot = await readContextSnapshot(env.CONTEXT_CACHE, snapshotKey, sourceVersion);
  if (snapshot) {
    try {
      const parsed = JSON.parse(snapshot);
      if (Array.isArray(parsed)) return capKnowledgeSnippets(parsed.map(String), charBudget);
    } catch {
      // Invalid optional cache data is ignored.
    }
  }
  const sourceHash = sourceVersion;
  const cacheKey = `knowledge:${customerId}:${assistantId}:${sourceHash}`;
  const cached = await getPromptCache(db, cacheKey, sourceHash);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
  }

  const match = terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(" OR ");
  let values: string[] = [];
  try {
    const rows = await db.prepare(
      `SELECT kc.title,kc.content,bm25(knowledge_chunks_fts) AS rank
       FROM knowledge_chunks_fts
       JOIN knowledge_chunks kc ON kc.id=knowledge_chunks_fts.chunk_id
       JOIN assistant_knowledge ak ON ak.collection_id=kc.collection_id
       WHERE ak.assistant_id=? AND kc.customer_id=? AND knowledge_chunks_fts MATCH ?
       ORDER BY rank ASC LIMIT 12`,
    ).bind(assistantId, customerId, match).all<any>();
    let remaining = Math.max(1000, charBudget);
    for (const row of rows.results ?? []) {
      if (remaining <= 0) break;
      const value = `${String(row.title || "Knowledge")}:\n${String(row.content || "")}`;
      const clipped = value.slice(0, remaining);
      if (clipped.trim()) values.push(clipped);
      remaining -= clipped.length;
    }
  } catch (error) {
    console.warn("FTS knowledge retrieval failed; using compatibility fallback", error);
  }

  if (!values.length) {
    let rows: any;
    try {
      rows = await db.prepare(
        `SELECT ki.title,ki.content_text FROM assistant_knowledge ak
         JOIN knowledge_items ki ON ki.collection_id=ak.collection_id
         WHERE ak.assistant_id=? AND ki.customer_id=? AND ki.status='ready' AND ki.content_text IS NOT NULL
         ORDER BY ki.updated_at DESC LIMIT 50`,
      ).bind(assistantId, customerId).all<any>();
    } catch {
      return [];
    }
    const scored = (rows.results ?? []).map((r: any) => {
      const text = String(r.content_text || "");
      const lower = text.toLowerCase();
      const score = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
      return { score, title: String(r.title || "Knowledge"), text };
    }).filter((r: { score: number }) => r.score > 0).sort((a: { score: number }, b: { score: number }) => b.score-a.score);

    let remaining = Math.max(1000, charBudget);
    for (const row of scored.slice(0, 6)) {
      if (remaining <= 0) break;
      const value = `${row.title}:\n${row.text.slice(0, Math.min(3200, remaining))}`;
      if (value.trim()) values.push(value);
      remaining -= value.length;
    }
  }

  values = capKnowledgeSnippets(values, charBudget);

  await putPromptCache({
    db,
    cacheKey,
    customerId,
    assistantId,
    kind: "knowledge_retrieval",
    value: JSON.stringify(values),
    sourceHash,
    ttlSeconds: 600,
  }).catch(() => undefined);
  await writeContextSnapshot(env.CONTEXT_CACHE, {
    ...snapshotIdentity, value: JSON.stringify(values), ttlSeconds: 300,
  });
  return values;
}

const reserveCredits = reserveInference;
const releaseReservation = releaseInferenceReservation;
const settleReservation = settleInference;

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

async function invokeJournaledProviderCall(
  env: AssistEnv,
  route: any,
  input: any,
  customerId: string,
  assistantId: string,
  replyJobId: string,
  reservationId: string,
  ordinal: number,
  estimatedInputTokens: number,
  multiplierBps: number,
  journaledAttemptIds: string[],
  reasoningMode: ReasoningMode = "standard",
  fallbackPolicy: ReasoningFallbackPolicy = "allow_lower_effort",
  conversationId = "",
  workloadIdentity?: { workloadType: "api_key"; workloadId: string },
) {
  const attemptId = attemptIdFor(replyJobId, reservationId, ordinal);
  const identity = workloadIdentity
    ? { customerId, attemptId, ...workloadIdentity }
    : { customerId, assistantId, attemptId };
  const journal = settlementJournalStub(
    env.SETTLEMENT_JOURNAL, customerId,
    workloadIdentity?.workloadId || assistantId,
    workloadIdentity ? "api_key" : "assistant",
  );
  const requestHash = await resilienceSha256Text(JSON.stringify(input));
  const configuredTarget = Array.isArray(route.__targets) && route.__targets.length ? route.__targets[0] : route;
  const initialRateSnapshot = Object.fromEntries([
    "input_credits_per_million", "output_credits_per_million", "reasoning_credits_per_million",
    "provider_input_cost_micros_per_million", "provider_output_cost_micros_per_million",
    "provider_reasoning_cost_micros_per_million", "rate_multiplier_bps",
  ].filter((key) => configuredTarget[key] != null).map((key) => [key, Number(configuredTarget[key])]));
  await recordAttemptProjection(env.DB, {
    ...identity, reservationId, requestHash, modelAlias: String(route.alias || "unknown"), replyJobId,
    conversationId: String(conversationId || input.conversationId || input.conversation_id || ""),
    provider: String(configuredTarget.provider || route.provider || "routed"),
    model: String(configuredTarget.provider_model || route.provider_model || route.alias || "unknown"),
    rateSnapshot: initialRateSnapshot, requestedReasoningMode: reasoningMode, appliedReasoningMode: reasoningMode,
  });
  const claim = await journal.claimAttempt({
    ...identity,
    reservationId,
    requestHash,
    provider: String(route.provider || "routed"),
    model: String(route.provider_model || route.alias || "unknown"),
    idempotencyKey: attemptId,
    startedAt: unix(),
  });
  const existing = claim.attempt;
  if (existing?.status === "result_recorded" || existing?.status === "settled") {
    if (!existing.result) throw new Error("journal_result_missing");
    journaledAttemptIds.push(attemptId);
    const metadata = existing.result.metadata || {};
    let targetRate: any = {};
    let priorAttempts: any[] = [];
    try { targetRate = JSON.parse(String(metadata.targetRateJson || "{}")); } catch {}
    try { priorAttempts = JSON.parse(String(metadata.priorAttemptsJson || "[]")); } catch {}
    await updateAttemptProjection(env.DB, {
      ...identity, status: existing.status, provider: String(metadata.provider || existing.provider),
      model: String(metadata.providerModel || existing.model), inputUnits: existing.result.inputUnits,
      outputUnits: existing.result.outputUnits, reasoningUnits: Number(metadata.reasoningUnits || 0),
      providerCostMicros: existing.result.providerCostMicros, rateSnapshot: targetRate,
      requestedReasoningMode: String(metadata.requestedReasoningMode || reasoningMode),
      appliedReasoningMode: String(metadata.appliedReasoningMode || reasoningMode),
    });
    return {
      response: existing.result.responseText,
      usage: { input_tokens: existing.result.inputUnits, output_tokens: existing.result.outputUnits, reasoning_tokens: Number(metadata.reasoningUnits || 0) },
      __mketyProvider: String(metadata.provider || existing.provider),
      __mketyProviderModel: String(metadata.providerModel || existing.model),
      __mketyTargetRate: targetRate,
      __mketyRequestedReasoningMode: String(metadata.requestedReasoningMode || reasoningMode),
      __mketyAppliedReasoningMode: String(metadata.appliedReasoningMode || reasoningMode),
      __mketyPriorAttempts: priorAttempts,
      __mketyAttemptId: attemptId,
      finish_reason: metadata.finishReason || undefined,
    };
  }
  if (existing?.status === "unknown_outcome") throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
  if (existing?.status === "started" && !claim.claimed) {
    if (Date.now() - existing.updatedAt > 5 * 60_000) await journal.markAttemptUnknown(identity);
    throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
  }
  journaledAttemptIds.push(attemptId);
  let journalResultRecorded = false;
  try {
    const result = await invokeRoutedModel(env, route, input, customerId, reasoningMode, fallbackPolicy);
    const text = extractAiText(result);
    const usage = extractUsage(result, estimatedInputTokens, text);
    const rate = { ...(result?.__mketyTargetRate || {}), rate_multiplier_bps: multiplierBps };
    const economics = modelAttemptEconomics({ inputUnits: usage.input, outputUnits: usage.output, reasoningUnits: usage.reasoning, targetRate: rate }, multiplierBps);
    const metadata = {
      provider: String(result?.__mketyProvider || route.provider || "unknown"),
      providerModel: String(result?.__mketyProviderModel || route.provider_model || "unknown"),
      targetRateJson: JSON.stringify(rate),
      reasoningUnits: usage.reasoning,
      requestedReasoningMode: result?.__mketyRequestedReasoningMode || reasoningMode,
      appliedReasoningMode: result?.__mketyAppliedReasoningMode || reasoningMode,
      priorAttemptsJson: JSON.stringify((Array.isArray(result?.__mketyPriorAttempts) ? result.__mketyPriorAttempts : []).map((attempt: any, index: number) => ({
        ...attempt,
        targetRate: { ...(attempt.targetRate || {}), rate_multiplier_bps: multiplierBps },
        providerAttemptId: String(attempt.providerAttemptId || `${attemptId}:fallback:${index}`),
      }))),
      finishReason: String(result?.finish_reason || result?.finishReason || ""),
    };
    result.__mketyAttemptId = attemptId;
    result.__mketyPriorAttempts = JSON.parse(metadata.priorAttemptsJson);
    await journal.recordAttemptResult(identity, {
      responseText: text,
      inputUnits: usage.input,
      outputUnits: usage.output,
      reasoningUnits: usage.reasoning,
      providerCostMicros: economics.providerCostMicros,
      credits: economics.credits,
      metadata,
    });
    journalResultRecorded = true;
    await updateAttemptProjection(env.DB, {
      ...identity, status: "result_recorded", provider: metadata.provider, model: metadata.providerModel,
      inputUnits: usage.input, outputUnits: usage.output, reasoningUnits: usage.reasoning,
      providerCostMicros: economics.providerCostMicros, rateSnapshot: rate,
      requestedReasoningMode: String(metadata.requestedReasoningMode),
      appliedReasoningMode: String(metadata.appliedReasoningMode),
    });
    return result;
  } catch (error) {
    if (journalResultRecorded) {
      await updateAttemptProjection(env.DB, {
        ...identity, status: "result_recorded", provider: String(route.provider || "routed"),
        model: String(route.provider_model || route.alias || "unknown"),
      }).catch(() => undefined);
      throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
    }
    const providerAttempted = Boolean((error as any)?.__mketyProviderAttempted);
    if (!providerAttempted) {
      await journal.markAttemptNotSubmitted(identity).catch(() => undefined);
      await updateAttemptProjection(env.DB, { ...identity, status: "not_submitted", resolved: true }).catch(() => undefined);
      throw error;
    }
    await journal.markAttemptUnknown(identity).catch(() => undefined);
    await updateAttemptProjection(env.DB, { ...identity, status: "unknown_outcome" }).catch(() => undefined);
    throw new RetryableInferenceError("provider_attempt_reconciliation_required", 60);
  }
}

async function resolveModelRoute(db: D1Database, customerId: string, alias: string) {
  const override = await db.prepare(
    `SELECT alias,provider,provider_model,provider_connection_id,fallback_provider,fallback_model,
            fallback_provider_connection_id,byok_policy,status
     FROM customer_model_routes
     WHERE customer_id=? AND alias=? AND status='active' LIMIT 1`,
  ).bind(customerId, alias).first<any>();
  const route = override ?? await db.prepare("SELECT * FROM model_routes WHERE alias=? AND status='active' LIMIT 1").bind(alias).first<any>();
  if (!route) return null;
  const customerScope = `customer:${customerId}:${alias}`;
  const globalScope = `global:${alias}`;
  let targets = await db.prepare(
    "SELECT * FROM model_route_targets WHERE scope_key=? AND enabled=1 ORDER BY position ASC",
  ).bind(customerScope).all<any>();
  if (!(targets.results ?? []).length) {
    targets = await db.prepare(
      "SELECT * FROM model_route_targets WHERE scope_key=? AND enabled=1 ORDER BY position ASC",
    ).bind(globalScope).all<any>();
  }
  return { ...route, __targets: targets.results ?? [] };
}

async function invokeRoutedModel(
  env: AssistEnv, route: any, input: any, customerId: string,
  reasoningMode: ReasoningMode = "standard", fallbackPolicy: ReasoningFallbackPolicy = "allow_lower_effort",
): Promise<any> {
  const inputChars = Array.isArray(input?.messages)
    ? input.messages.reduce((n: number, m: any) => n + String(m?.content || "").length, 0)
    : JSON.stringify(input || {}).length;
  const estimatedInputTokens = Math.max(1, Math.ceil(inputChars / 4));
  const estimatedTokens = Math.max(1, estimatedInputTokens + Number(input?.max_tokens || 0));
  const alias = String(route.alias || route.provider_model || route.provider || "unknown");
  const configuredTargets = Array.isArray(route.__targets) && route.__targets.length
    ? route.__targets
    : [
        { position: 0, provider: route.provider, provider_model: route.provider_model, provider_connection_id: route.provider_connection_id },
        ...(route.fallback_provider && route.fallback_model
          ? [{ position: 1, provider: route.fallback_provider, provider_model: route.fallback_model, provider_connection_id: route.fallback_provider_connection_id }]
          : []),
      ];

  // Resolve a single applied tier before any paid provider request. An explicit
  // lower-tier fallback happens only when the owner selected that policy and no
  // enabled target supports their requested tier.
  let reasoningPlan: ReturnType<typeof planReasoningTargets>;
  try {
    reasoningPlan = planReasoningTargets(configuredTargets, reasoningMode, fallbackPolicy);
  } catch (error) {
    (error as any).__mketyProviderAttempted = false;
    throw error;
  }
  const eligibleTargetSet = new Set(reasoningPlan.targets);

  let lastError: unknown = null;
  let providerAttempted = false;
  const billablePriorAttempts: any[] = [];
  for (let index = 0; index < configuredTargets.length; index++) {
    const target = configuredTargets[index];
    if (!target?.provider || !target?.provider_model) continue;
    if (!eligibleTargetSet.has(target)) continue;
    if (target.provider_connection_id) {
      const ownership = await env.DB.prepare(
        "SELECT ownership,customer_id,status,validated_at FROM provider_connections WHERE id=? LIMIT 1",
      ).bind(target.provider_connection_id).first<any>();
      if (!ownership || ownership.status !== "active" || !ownership.validated_at) continue;
      if (ownership.ownership === "customer" && ownership.customer_id !== customerId) continue;
      if (index > 0) {
        const primary = configuredTargets[0];
        const primaryOwnership = primary?.provider_connection_id
          ? await env.DB.prepare("SELECT ownership FROM provider_connections WHERE id=? LIMIT 1").bind(primary.provider_connection_id).first<any>()
          : null;
        const fallbackIsManaged = ownership.ownership === "mkety";
        if (!mayUseFallback(String(route.byok_policy || "managed") as any, primaryOwnership?.ownership === "customer", fallbackIsManaged)) {
          continue;
        }
      }
    }

    const capacity = await claimModelCapacity(env.DB, customerId, alias, estimatedTokens);
    if (!capacity.allowed) {
      lastError = new RetryableInferenceError("model_capacity_wait", capacity.retryAfterSeconds);
      continue;
    }

    try {
      const requestInput = { ...(input && typeof input === "object" ? input : {}) };
      // Effort is derived only from authenticated assistant settings, never the
      // public inference request body.
      delete requestInput.reasoning_effort;
      let declaredCapabilities: string[] = [];
      try { declaredCapabilities = JSON.parse(String(target.reasoning_capabilities_json || "[]")); } catch {}
      const requestedOptions = providerReasoningOptions(String(target.provider), String(target.provider_model), reasoningPlan.appliedMode, declaredCapabilities);
      if (reasoningPlan.appliedMode !== "standard" && !requestedOptions) continue;
      requestInput.__mketyReasoningOptions = requestedOptions || {};
      Object.assign(requestInput, requestedOptions || {});
      providerAttempted = true;
      const result = annotateProviderResult(
        await invokeProviderModel(env, target, requestInput, customerId),
        String(target.provider),
        String(target.provider_model),
        target,
      );
      result.__mketyRequestedReasoningMode = reasoningPlan.requestedMode;
      result.__mketyAppliedReasoningMode = reasoningPlan.appliedMode;
      const text = extractAiText(result);
      if (!text) {
        const usage = extractUsage(result, estimatedInputTokens, "");
        billablePriorAttempts.push({
          provider: String(target.provider),
          providerModel: String(target.provider_model),
          inputUnits: usage.input,
          outputUnits: usage.output,
          reasoningUnits: usage.reasoning,
          targetRate: result?.__mketyTargetRate || target,
          requestedReasoningMode: reasoningPlan.requestedMode,
          appliedReasoningMode: reasoningPlan.appliedMode,
          reason: "empty_model_response",
        });
        throw new Error(`empty_model_response:${String(target.provider)}:${String(target.provider_model)}`);
      }
      return { ...result, __mketyPriorAttempts: billablePriorAttempts };
    } catch (error) {
      lastError = error;
      if (providerAttempted && !String(error instanceof Error ? error.message : error).includes("empty_model_response")) {
        // The provider accepted the attempt far enough to return an error; preserve the fact for reconciliation.
        billablePriorAttempts.push({
          provider: String(target.provider),
          providerModel: String(target.provider_model),
          inputUnits: estimatedInputTokens,
          outputUnits: 0,
          reasoningUnits: 0,
          targetRate: target,
          requestedReasoningMode: reasoningPlan.requestedMode,
          appliedReasoningMode: reasoningPlan.appliedMode,
          reason: "provider_error_outcome_unknown",
        });
      }
      const classified = classifyRetryableError(error);
      console.warn("model target failed; trying next ordered fallback", {
        alias,
        provider: target.provider,
        model: target.provider_model,
        position: target.position ?? index,
        retryable: classified.retryable,
        error: classified.message,
      });
    }
  }
  if (lastError) {
    if (lastError && typeof lastError === "object") {
      (lastError as any).__mketyPriorAttempts = billablePriorAttempts;
      (lastError as any).__mketyProviderAttempted = providerAttempted;
    }
    throw lastError;
  }
  const unavailable = new Error("No enabled model route target is available.");
  (unavailable as any).__mketyPriorAttempts = billablePriorAttempts;
  throw unavailable;
}

function annotateProviderResult(result: any, provider: string, model: string, target?: any) {
  const targetRate = target ? {
    input_credits_per_million: Number(target.input_credits_per_million || 0),
    output_credits_per_million: Number(target.output_credits_per_million || 0),
    image_credits: Number(target.image_credits || 0),
    audio_credits_per_minute: Number(target.audio_credits_per_minute || 0),
    provider_input_cost_micros_per_million: Number(target.provider_input_cost_micros_per_million || 0),
    provider_output_cost_micros_per_million: Number(target.provider_output_cost_micros_per_million || 0),
    provider_image_cost_micros: Number(target.provider_image_cost_micros || 0),
    provider_audio_cost_micros_per_minute: Number(target.provider_audio_cost_micros_per_minute || 0),
    reasoning_credits_per_million: target.reasoning_credits_per_million == null ? null : Number(target.reasoning_credits_per_million),
    provider_reasoning_cost_micros_per_million: target.provider_reasoning_cost_micros_per_million == null ? null : Number(target.provider_reasoning_cost_micros_per_million),
  } : null;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return { ...result, __mketyProvider: provider, __mketyProviderModel: model, __mketyTargetRate: targetRate };
  }
  return { response: String(result ?? ""), __mketyProvider: provider, __mketyProviderModel: model, __mketyTargetRate: targetRate };
}

function utf8Bytes(value: string | Uint8Array) {
  return typeof value === "string" ? encoder.encode(value) : value;
}

async function digestSha256(value: string | Uint8Array) {
  const data = utf8Bytes(value);
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  ));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function invokeProviderModel(env: AssistEnv, route: any, input: any, customerId: string): Promise<any> {
  const provider = String(route.provider || "");
  if (provider === "workers-ai" || provider === "mkety-managed") {
    const normalized: any = input && typeof input === "object" ? { ...input } : input;
    if (normalized && Array.isArray(normalized.messages)) {
      const requestedCompletion = Number(normalized.max_completion_tokens || normalized.max_tokens || 1536);
      const maxCompletion = Number.isFinite(requestedCompletion)
        ? Math.max(1, Math.min(2048, Math.floor(requestedCompletion)))
        : 1536;
      delete normalized.max_tokens;
      normalized.max_completion_tokens = maxCompletion;
      if (normalized.reasoning_effort === undefined) {
        const userText = String([...normalized.messages].reverse().find((message: any) => message.role === "user")?.content || "");
        normalized.reasoning_effort = selectReasoningEffort({
          provider,
          model: String(route.provider_model || ""),
          userText,
        }) || "low";
      }
    }
    return env.AI.run(String(route.provider_model), normalized);
  }

  if (!route.provider_connection_id) throw new Error("Provider connection is not configured for this model route.");
  const connection = await env.DB.prepare(
    "SELECT provider,endpoint_url,api_key_ciphertext,extra_json,status,ownership,customer_id,validated_at FROM provider_connections WHERE id=? AND status='active' LIMIT 1",
  ).bind(route.provider_connection_id).first<any>();
  if (!connection?.api_key_ciphertext || !connection.validated_at) throw new Error("Provider connection is unavailable or unvalidated.");
  if (connection.provider !== provider) throw new Error("Provider connection type does not match model route.");
  if (connection.ownership === "customer" && connection.customer_id !== customerId) throw new Error("Customer BYOK provider scope mismatch.");
  const apiKey = await revealSecret(connection.api_key_ciphertext, env.MKETY_ASSIST_SECRET_ENCRYPTION_KEY);
  const extra = connection.extra_json ? JSON.parse(connection.extra_json) : {};
  const model = String(route.provider_model);
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const maxTokens = Math.max(1, Math.min(2048, parseInt(String(input.max_tokens || 1536), 10) || 1536));
  const temperature = typeof input.temperature === "number" ? input.temperature : 0.4;

  if (provider === "openai") {
    const base = String(connection.endpoint_url || "https://api.openai.com/v1").replace(/\/$/, "");
    const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
    const response = await fetch(`${base}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: systemText || undefined,
        input: messages.filter((m: any) => m.role !== "system").map((m: any) => ({ role: m.role, content: String(m.content || "") })),
        max_output_tokens: maxTokens,
        ...openAIReasoningOptions(model, messages),
        ...(input.__mketyReasoningOptions || {}),
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const output = Array.isArray(payload?.output) ? payload.output : [];
    return {
      response: typeof payload?.output_text === "string" ? payload.output_text : output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((part: any) => typeof part?.text === "string" ? part.text : "").join(""),
      usage: payload?.usage,
      raw: payload,
    };
  }

  if (provider === "openai-compatible") {
    const base = String(connection.endpoint_url || "").replace(/\/$/, "");
    if (!base) throw new Error("OpenAI-compatible endpoint is missing.");
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, ...(input.__mketyReasoningOptions || {}) }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
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
      body: JSON.stringify({ model, system: String(systemMessage), messages: chatMessages, max_tokens: maxTokens, temperature, ...(input.__mketyReasoningOptions || {}) }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
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
        generationConfig: { maxOutputTokens: maxTokens, temperature, ...((input.__mketyReasoningOptions || {}).generationConfig || {}) },
      }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
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
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature, ...(input.__mketyReasoningOptions || {}) }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    return payload;
  }

  if (provider === "azure-foundry") {
    const endpoint = String(connection.endpoint_url || "").replace(/\/$/, "");
    if (!endpoint) throw new Error("Azure AI Foundry endpoint is missing.");
    const url = /\/openai\/v1\/responses$/i.test(endpoint) ? endpoint : `${endpoint}/openai/v1/responses`;
    const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
    const inputItems = messages.filter((m: any) => m.role !== "system").map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    }));
    const response = await fetch(url, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ model, instructions: systemText || undefined, input: inputItems, max_output_tokens: maxTokens, ...(input.__mketyReasoningOptions || {}) }),
    });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
    const output = Array.isArray(payload?.output) ? payload.output : [];
    const responseText = typeof payload?.output_text === "string"
      ? payload.output_text
      : output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
          .map((part: any) => typeof part?.text === "string" ? part.text : "")
          .join("");
    return {
      response: responseText,
      usage: {
        input_tokens: payload?.usage?.input_tokens ?? payload?.usage?.inputTokens,
        output_tokens: payload?.usage?.output_tokens ?? payload?.usage?.outputTokens,
      },
      raw: payload,
    };
  }

  if (provider === "vertex") {
    const service = await vertexAccessTokenFromServiceAccount(apiKey);
    const projectId = String(extra.projectId || service.projectId || "").trim();
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
        headers: { authorization: `Bearer ${service.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature, ...((input.__mketyReasoningOptions || {}).generationConfig || {}) },
        }),
      },
    );
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
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
      throw providerHttpError(response, payload);
    }
    return payload?.result ?? payload;
  }

  if (provider === "bedrock") {
    const configuredRegion = String(extra.region || "").trim();
    const body = JSON.stringify({
      system: messages.filter((m: any) => m.role === "system").map((m: any) => ({ text: String(m.content || "") })),
      messages: messages.filter((m: any) => m.role !== "system").map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: [{ text: String(m.content || "") }],
      })),
      inferenceConfig: { maxTokens, temperature },
    });
    const preliminaryRegion = configuredRegion || "us-east-1";
    const host = `bedrock-runtime.${preliminaryRegion}.amazonaws.com`;
    const requestPath = `/model/${encodeURIComponent(model)}/converse`;
    const signed = await bedrockHeadersFromCredentialJson({
      secret: apiKey,
      region: configuredRegion || undefined,
      host,
      path: requestPath,
      body,
    });
    const effectiveHost = `bedrock-runtime.${signed.region}.amazonaws.com`;
    const finalSigned = effectiveHost === host ? signed : await bedrockHeadersFromCredentialJson({
      secret: apiKey,
      region: signed.region,
      host: effectiveHost,
      path: requestPath,
      body,
    });
    const response = await fetch(`https://${effectiveHost}${requestPath}`, { method: "POST", headers: finalSigned.headers, body });
    const payload = await response.json<any>();
    if (!response.ok) throw providerHttpError(response, payload);
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

function openAIReasoningOptions(model: string, messages: any[]) {
  const userText = String([...messages].reverse().find((message) => message?.role === "user")?.content || "");
  const effort = selectReasoningEffort({ provider: "openai", model, userText });
  return effort ? { reasoning: { effort } } : {};
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

async function pauseConversationForManualReply(
  db: D1Database,
  assistant: any,
  chatId: string,
  businessConnectionId: string | null,
  message: any,
) {
  const conversation = await upsertConversation(db, assistant.customer_id, assistant.id, chatId);
  const now = unix();
  const pauseSeconds = Math.max(60, Math.min(86400, Number(assistant.manual_reply_pause_seconds || 900)));
  const resumeAt = now + pauseSeconds;
  const text = String(message?.text || message?.caption || "").trim();

  const statements = [
    db.prepare(
      "UPDATE conversations SET automation_paused=1,automation_resume_at=?,automation_pause_reason='human_manual_reply',business_connection_id=COALESCE(?,business_connection_id),updated_at=? WHERE id=? AND customer_id=? AND assistant_id=?",
    ).bind(resumeAt, businessConnectionId, now, conversation.id, assistant.customer_id, assistant.id),
    db.prepare(
      "UPDATE reply_jobs SET status='cancelled',last_error='human_manual_reply',completed_at=?,locked_at=NULL,delivery_started_at=NULL,updated_at=? WHERE conversation_id=? AND customer_id=? AND assistant_id=? AND status IN ('pending','retry','processing')",
    ).bind(now, now, conversation.id, assistant.customer_id, assistant.id),
  ];
  if (text) {
    statements.push(
      db.prepare(
        "INSERT INTO messages (id,customer_id,assistant_id,conversation_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)",
      ).bind(id("msg"), assistant.customer_id, assistant.id, conversation.id, "human", text.slice(0, 30000), now),
    );
  }
  await db.batch(statements);
  return { conversationId: conversation.id, resumeAt };
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
    "UPDATE webhook_events SET status=?,processed_at=?,processing_at=NULL WHERE source=? AND external_event_id=?",
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
      allowed_updates: [
        "message",
        "edited_message",
        "business_connection",
        "business_message",
        "edited_business_message",
        "deleted_business_messages",
      ],
      drop_pending_updates: false,
    }),
  }).then((r) => r.json<any>());
}

async function effectiveSenderControl(
  db: D1Database,
  customerId: string,
  assistantId: string,
  channel: string,
  senderId: string,
) {
  const row = await db.prepare(
    "SELECT state,reason,expires_at FROM channel_sender_controls WHERE customer_id=? AND assistant_id=? AND channel=? AND sender_id=? LIMIT 1",
  ).bind(customerId,assistantId,channel,senderId).first<any>();
  if (!row) return { state: "active", reason: null, expiresAt: null };
  const expiresAt = row.expires_at === null || row.expires_at === undefined ? null : Number(row.expires_at);
  if (expiresAt && expiresAt <= unix()) {
    await db.prepare(
      "UPDATE channel_sender_controls SET state='active',reason=NULL,expires_at=NULL,updated_at=? WHERE customer_id=? AND assistant_id=? AND channel=? AND sender_id=?",
    ).bind(unix(),customerId,assistantId,channel,senderId).run();
    return { state: "active", reason: null, expiresAt: null };
  }
  return { state: String(row.state), reason: row.reason ? String(row.reason) : null, expiresAt };
}

export function shouldIgnoreSecretaryEvent(input: {
  outgoing?: boolean;
  senderId?: string | number | null;
  connectedAccountId?: string | number | null;
}) {
  if (input.outgoing === true) return true;
  if (input.senderId === null || input.senderId === undefined) return false;
  if (input.connectedAccountId === null || input.connectedAccountId === undefined) return false;
  return String(input.senderId) === String(input.connectedAccountId);
}

async function telegramSend(
  token: string,
  chatId: string,
  text: string,
  businessConnectionId: string | null = null,
  replyToMessageId: string | number | null = null,
  replyMarkup: Record<string, unknown> | null = null,
) {
  const chunks = splitTelegram(text);
  let last: any = { ok: true };
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const numericReplyId = replyToMessageId == null ? null : Number(replyToMessageId);
    const replyParameters = index === 0 && Number.isFinite(numericReplyId) && numericReplyId! > 0
      ? { reply_parameters: { message_id: numericReplyId, allow_sending_without_reply: true } }
      : {};
    last = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
        ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
        ...(index === 0 && replyMarkup ? { reply_markup: replyMarkup } : {}),
        ...replyParameters,
      }),
    }).then((r) => r.json<any>());
    if (!last.ok) return last;
  }
  return last;
}

async function telegramAction(token: string, chatId: string, action: string, businessConnectionId: string | null = null) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action, ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}) }),
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

function textFromContentParts(value: any): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value.map((part: any) => {
    if (typeof part === "string") return part;
    if (typeof part?.text === "string") return part.text;
    if (typeof part?.output_text === "string") return part.output_text;
    if (typeof part?.content === "string") return part.content;
    return "";
  }).join("").trim();
}

function extractAiText(result: any): string {
  if (typeof result?.response === "string" && result.response.trim()) return result.response.trim();
  if (typeof result?.result?.response === "string" && result.result.response.trim()) return result.result.response.trim();
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  if (typeof result?.text === "string" && result.text.trim()) return result.text.trim();

  if (Array.isArray(result?.choices)) {
    for (const choice of result.choices) {
      const messageText = textFromContentParts(choice?.message?.content);
      if (messageText) return messageText;
      if (typeof choice?.text === "string" && choice.text.trim()) return choice.text.trim();
    }
  }

  if (Array.isArray(result?.output)) {
    const outputText = result.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
      .map((part: any) => typeof part?.text === "string" ? part.text : (typeof part?.output_text === "string" ? part.output_text : ""))
      .join("")
      .trim();
    if (outputText) return outputText;
  }

  if (Array.isArray(result?.candidates)) {
    for (const candidate of result.candidates) {
      const candidateText = textFromContentParts(candidate?.content?.parts);
      if (candidateText) return candidateText;
    }
  }

  const nestedResult = result?.result;
  if (nestedResult && nestedResult !== result) {
    const nested: string = extractAiText(nestedResult);
    if (nested) return nested;
  }
  return "";
}

function routedResultAttempt(result: any, estimatedInputTokens: number, text: string) {
  const usage = extractUsage(result, estimatedInputTokens, text);
  return {
    providerAttemptId: String(result?.__mketyAttemptId || ""),
    provider: String(result?.__mketyProvider || "unknown"),
    providerModel: String(result?.__mketyProviderModel || "unknown"),
    inputUnits: usage.input,
    outputUnits: usage.output,
    reasoningUnits: usage.reasoning,
    requestedReasoningMode: String(result?.__mketyRequestedReasoningMode || "standard"),
    appliedReasoningMode: String(result?.__mketyAppliedReasoningMode || "standard"),
    targetRate: result?.__mketyTargetRate || {},
    reason: "completed_intermediate_call",
  };
}

function modelAttemptEconomics(attempt: any, multiplierBps: number) {
  const rate = attempt?.targetRate || {};
  const inputRate = Math.ceil(Number(rate.input_credits_per_million || 0) * multiplierBps / 10000);
  const outputRate = Math.ceil(Number(rate.output_credits_per_million || 0) * multiplierBps / 10000);
  const reasoningRate = rate.reasoning_credits_per_million == null
    ? 0
    : Math.ceil(Number(rate.reasoning_credits_per_million || 0) * multiplierBps / 10000);
  const rawCredits = Math.max(0, Math.ceil((
    Number(attempt?.inputUnits || 0) * inputRate
    + Number(attempt?.outputUnits || 0) * outputRate
    + Number(attempt?.reasoningUnits || 0) * reasoningRate
  ) / 1_000_000));
  const providerCostMicros = Math.max(0, Math.ceil((
    Number(attempt?.inputUnits || 0) * Number(rate.provider_input_cost_micros_per_million || 0)
    + Number(attempt?.outputUnits || 0) * Number(rate.provider_output_cost_micros_per_million || 0)
    + Number(attempt?.reasoningUnits || 0) * Number(rate.provider_reasoning_cost_micros_per_million || 0)
  ) / 1_000_000));
  const credits = providerCostMicros > 0 ? Math.max(1, rawCredits) : rawCredits;
  return { credits, providerCostMicros };
}

function modelResponseWasTruncated(result: any) {
  const finish = String(
    result?.finish_reason ??
    result?.finishReason ??
    result?.stop_reason ??
    result?.stopReason ??
    result?.choices?.[0]?.finish_reason ??
    result?.raw?.finish_reason ??
    result?.raw?.finishReason ??
    result?.raw?.stop_reason ??
    result?.raw?.stopReason ??
    result?.raw?.choices?.[0]?.finish_reason ??
    result?.raw?.candidates?.[0]?.finishReason ??
    "",
  ).toLowerCase();
  return ["length","max_tokens","max_output_tokens","max_tokens_reached"].some((value) => finish.includes(value));
}

function extractUsage(result: any, estimatedInput: number, text: string) {
  const usage = result?.usage || result?.result?.usage || result?.raw?.usage || {};
  return {
    input: parseFloat(String(usage.prompt_tokens || usage.input_tokens || usage.inputTokens || estimatedInput)),
    output: parseFloat(String(usage.completion_tokens || usage.output_tokens || usage.outputTokens || Math.max(1, Math.ceil(text.length / 4)))),
    reasoning: Math.max(0, parseFloat(String(
      usage.reasoning_tokens ?? usage.reasoningTokens ?? usage.output_tokens_details?.reasoning_tokens ??
      usage.completion_tokens_details?.reasoning_tokens ?? usage.thoughts_token_count ?? usage.thoughtsTokenCount ?? 0,
    )) || 0),
  };
}

function clampNumber(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(400, "invalid_numeric_value");
  return Math.max(min, Math.min(max, Math.floor(n)));
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
