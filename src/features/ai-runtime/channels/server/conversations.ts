import { and, desc, eq, lte, or, sql } from 'drizzle-orm';

import type { EnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solutions';
import { db } from '@/shared/db/cloudflare';
import {
  aiConversations,
  aiMessages,
  aiProviderConnections,
  aiScheduledActions,
} from '@/shared/db/schema/ai-runtime';

export type EnterpriseAiScheduledPayload = {
  recipientId: string;
  text: string;
  replyToId?: string;
  contextId?: string;
  sourceProviderMessageId?: string;
  commitment?: string;
  sourceQuote?: string;
  inboundRetry?: {
    originalProviderMessageId: string;
    senderId: string;
    externalConversationId: string;
    replyRecipientId: string;
    replyToId?: string;
    contextId?: string;
    requestedModel?: string;
  };
};

export async function ensureEnterpriseAiConversation(input: {
  tenantId: string;
  projectId?: string | null;
  solutionInstanceId?: string | null;
  connectionId: string;
  externalConversationId: string;
  externalUserId?: string | null;
  replyRecipientId?: string | null;
  replyContextId?: string | null;
}) {
  const existing = await db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.connectionId, input.connectionId),
      eq(aiConversations.externalConversationId, input.externalConversationId),
    ),
  });
  const now = new Date();
  if (existing) {
    await db.update(aiConversations).set({
      externalUserId: input.externalUserId ?? existing.externalUserId,
      replyRecipientId: input.replyRecipientId ?? existing.replyRecipientId,
      replyContextId: input.replyContextId ?? existing.replyContextId,
      solutionInstanceId: input.solutionInstanceId ?? existing.solutionInstanceId,
      projectId: input.projectId ?? existing.projectId,
      lastInboundAt: now,
      updatedAt: now,
    }).where(and(
      eq(aiConversations.id, existing.id),
      eq(aiConversations.tenantId, input.tenantId),
    ));
    return { ...existing, lastInboundAt: now, updatedAt: now };
  }

  const [created] = await db.insert(aiConversations).values({
    tenantId: input.tenantId,
    projectId: input.projectId ?? null,
    solutionInstanceId: input.solutionInstanceId ?? null,
    connectionId: input.connectionId,
    externalConversationId: input.externalConversationId,
    externalUserId: input.externalUserId ?? null,
    replyRecipientId: input.replyRecipientId ?? null,
    replyContextId: input.replyContextId ?? null,
    status: 'automated',
    lastInboundAt: now,
  }).onConflictDoNothing({
    target: [aiConversations.connectionId, aiConversations.externalConversationId],
  }).returning();
  if (created) return created;

  const raced = await db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.connectionId, input.connectionId),
      eq(aiConversations.externalConversationId, input.externalConversationId),
      eq(aiConversations.tenantId, input.tenantId),
    ),
  });
  if (!raced) throw new Error('Enterprise AI conversation could not be created.');
  return raced;
}

export async function recordEnterpriseAiMessage(input: {
  tenantId: string;
  conversationId: string;
  requestId?: string | null;
  direction: 'inbound' | 'outbound' | 'system';
  role: 'user' | 'assistant' | 'system' | 'tool';
  providerMessageId?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.content.trim()) return null;
  try {
    const [message] = await db.insert(aiMessages).values({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      requestId: input.requestId ?? null,
      direction: input.direction,
      role: input.role,
      providerMessageId: input.providerMessageId ?? null,
      content: input.content.slice(0, 200_000),
      metadata: input.metadata ?? {},
    }).returning();
    return message ?? null;
  } catch {
    if (input.providerMessageId) {
      return db.query.aiMessages.findFirst({
        where: and(
          eq(aiMessages.conversationId, input.conversationId),
          eq(aiMessages.providerMessageId, input.providerMessageId),
        ),
      });
    }
    throw new Error('Enterprise AI message could not be recorded.');
  }
}


export async function getBoundedEnterpriseAiConversationContext(input: {
  tenantId: string;
  conversationId: string;
  maxMessages?: number;
  maxCharacters?: number;
}) {
  const maxMessages = Math.max(1, Math.min(24, input.maxMessages ?? 12));
  const maxCharacters = Math.max(1_000, Math.min(48_000, input.maxCharacters ?? 24_000));
  const rows = await db.query.aiMessages.findMany({
    where: and(
      eq(aiMessages.tenantId, input.tenantId),
      eq(aiMessages.conversationId, input.conversationId),
    ),
    orderBy: [desc(aiMessages.createdAt)],
    limit: maxMessages,
  });

  let used = 0;
  const selected: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> = [];
  for (const row of rows) {
    if (!['user', 'assistant'].includes(row.role)) continue;
    const available = maxCharacters - used;
    if (available <= 0) break;
    const content = row.content.slice(-available);
    selected.push({ role: row.role as 'user' | 'assistant', content });
    used += content.length;
  }
  return selected.reverse();
}

export async function markEnterpriseAiConversationOutbound(conversationId: string, tenantId: string) {
  const now = new Date();
  await db.update(aiConversations).set({
    lastOutboundAt: now,
    updatedAt: now,
  }).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.tenantId, tenantId)));
}

export async function scheduleEnterpriseAiAction(input: {
  tenantId: string;
  conversationId?: string | null;
  solutionInstanceId?: string | null;
  connectionId: string;
  kind: 'delayed_reply' | 'commitment_reminder' | 'inbound_retry';
  idempotencyKey: string;
  dueAt: Date;
  payload: EnterpriseAiScheduledPayload;
}) {
  const connection = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.id, input.connectionId),
      eq(aiProviderConnections.tenantId, input.tenantId),
      eq(aiProviderConnections.mode, 'channel'),
      eq(aiProviderConnections.status, 'active'),
    ),
    columns: { id: true },
  });
  if (!connection) throw new Error('Enterprise AI channel is not active.');

  const existing = await db.query.aiScheduledActions.findFirst({
    where: and(
      eq(aiScheduledActions.tenantId, input.tenantId),
      eq(aiScheduledActions.idempotencyKey, input.idempotencyKey.slice(0, 180)),
    ),
  });
  if (existing) return existing;

  const [created] = await db.insert(aiScheduledActions).values({
    tenantId: input.tenantId,
    conversationId: input.conversationId ?? null,
    solutionInstanceId: input.solutionInstanceId ?? null,
    connectionId: input.connectionId,
    kind: input.kind,
    idempotencyKey: input.idempotencyKey.slice(0, 180),
    status: 'pending',
    dueAt: input.dueAt,
    payload: input.payload,
  }).returning();
  if (!created) throw new Error('Enterprise AI scheduled action could not be created.');
  return created;
}

export async function listClaimableEnterpriseAiActions(now = new Date(), limit = 25) {
  return db.query.aiScheduledActions.findMany({
    where: and(
      or(
        eq(aiScheduledActions.status, 'pending'),
        and(
          eq(aiScheduledActions.status, 'claimed'),
          lte(aiScheduledActions.claimUntil, now),
        ),
      ),
      lte(aiScheduledActions.dueAt, now),
    ),
    orderBy: (table, { asc }) => [asc(table.dueAt)],
    limit: Math.max(1, Math.min(100, limit)),
  });
}

export async function claimEnterpriseAiScheduledAction(id: string, tenantId: string, now = new Date()) {
  const claimUntil = new Date(now.getTime() + 60_000);
  const [claimed] = await db.update(aiScheduledActions).set({
    status: 'claimed',
    claimUntil,
    attempts: sql`${aiScheduledActions.attempts} + 1`,
    updatedAt: now,
  }).where(and(
    eq(aiScheduledActions.id, id),
    eq(aiScheduledActions.tenantId, tenantId),
    or(
      eq(aiScheduledActions.status, 'pending'),
      and(eq(aiScheduledActions.status, 'claimed'), lte(aiScheduledActions.claimUntil, now)),
    ),
  )).returning();
  return claimed ?? null;
}

export async function completeEnterpriseAiScheduledAction(id: string, tenantId: string) {
  const now = new Date();
  await db.update(aiScheduledActions).set({
    status: 'sent',
    completedAt: now,
    claimUntil: null,
    lastError: null,
    updatedAt: now,
  }).where(and(eq(aiScheduledActions.id, id), eq(aiScheduledActions.tenantId, tenantId)));
}

export async function failEnterpriseAiScheduledAction(
  id: string,
  tenantId: string,
  attempts: number,
  maxAttempts: number,
  error: string,
) {
  const terminal = attempts >= maxAttempts;
  await db.update(aiScheduledActions).set({
    status: terminal ? 'failed' : 'pending',
    attempts,
    claimUntil: null,
    lastError: error.slice(0, 1000),
    dueAt: terminal ? new Date() : new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(6, attempts))),
    updatedAt: new Date(),
  }).where(and(eq(aiScheduledActions.id, id), eq(aiScheduledActions.tenantId, tenantId)));
}

export async function markEnterpriseAiScheduledActionReconciliationRequired(
  id: string,
  tenantId: string,
  error: string,
) {
  const now = new Date();
  await db.update(aiScheduledActions).set({
    status: 'reconciliation_required',
    claimUntil: null,
    lastError: error.slice(0, 1000),
    updatedAt: now,
  }).where(and(eq(aiScheduledActions.id, id), eq(aiScheduledActions.tenantId, tenantId)));
}

export async function cancelEnterpriseAiScheduledActionsForConversation(conversationId: string, tenantId: string) {
  const now = new Date();
  await db.update(aiScheduledActions).set({
    status: 'cancelled',
    cancelledAt: now,
    claimUntil: null,
    updatedAt: now,
  }).where(and(
    eq(aiScheduledActions.conversationId, conversationId),
    eq(aiScheduledActions.tenantId, tenantId),
    or(eq(aiScheduledActions.status, 'pending'), eq(aiScheduledActions.status, 'claimed')),
  ));
}

export async function deterministicReplyDelaySeconds(
  configuration: EnterpriseAiSolutionConfiguration,
  providerMessageId: string,
) {
  if (configuration.replyDelayMode === 'off') return 0;
  const min = Math.max(0, Math.min(900, configuration.replyDelayMinSeconds));
  const max = configuration.replyDelayMode === 'fixed'
    ? min
    : Math.max(min, Math.min(900, configuration.replyDelayMaxSeconds));
  if (max <= min) return min;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(providerMessageId)));
  const bucket = ((digest[0] ?? 0) << 8) + (digest[1] ?? 0);
  return min + (bucket % (max - min + 1));
}
