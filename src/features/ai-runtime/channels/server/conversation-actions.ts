'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { revealChannelCredentials } from '@/features/ai-runtime/channels/credentials';
import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import {
  cancelEnterpriseAiScheduledActionsForConversation,
  markEnterpriseAiConversationOutbound,
  recordEnterpriseAiMessage,
} from '@/features/ai-runtime/channels/server/conversations';
import { deliverEnterpriseAiChannelMessage } from '@/features/ai-runtime/channels/transport';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { type EntitlementKey, isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import {
  aiConversations,
  aiMessages,
  aiProviderConnections,
  aiSolutionInstances,
} from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

function channelFromProvider(providerKey: string) {
  if (!providerKey.startsWith('channel:')) return null;
  return getEnterpriseAiChannel(providerKey.slice('channel:'.length) as EnterpriseAiChannelKey);
}

async function requireConversation(tenantSlug: string, conversationId: string) {
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEnterpriseAiAccess(tenant.id))) throw new Error('Enterprise AI is not active.');

  const conversation = await db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.tenantId, tenant.id),
    ),
  });
  if (!conversation) throw new Error('Conversation not found.');
  return { tenant, conversation };
}

export async function listEnterpriseAiConversations(tenantId: string, limit = 100) {
  return db.select({
    id: aiConversations.id,
    solutionInstanceId: aiConversations.solutionInstanceId,
    solutionName: aiSolutionInstances.name,
    connectionId: aiConversations.connectionId,
    providerKey: aiProviderConnections.providerKey,
    externalConversationId: aiConversations.externalConversationId,
    externalUserId: aiConversations.externalUserId,
    status: aiConversations.status,
    handoffReason: aiConversations.handoffReason,
    handoffAt: aiConversations.handoffAt,
    lastInboundAt: aiConversations.lastInboundAt,
    lastOutboundAt: aiConversations.lastOutboundAt,
    updatedAt: aiConversations.updatedAt,
  })
    .from(aiConversations)
    .leftJoin(aiSolutionInstances, eq(aiConversations.solutionInstanceId, aiSolutionInstances.id))
    .leftJoin(aiProviderConnections, eq(aiConversations.connectionId, aiProviderConnections.id))
    .where(eq(aiConversations.tenantId, tenantId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(Math.max(1, Math.min(250, limit)));
}

export async function listEnterpriseAiConversationMessages(
  tenantId: string,
  conversationId: string,
  limit = 100,
) {
  return db.query.aiMessages.findMany({
    where: and(
      eq(aiMessages.tenantId, tenantId),
      eq(aiMessages.conversationId, conversationId),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
    limit: Math.max(1, Math.min(250, limit)),
  });
}

export async function takeOverEnterpriseAiConversation(
  tenantSlug: string,
  conversationId: string,
  formData: FormData,
) {
  const { tenant, conversation } = await requireConversation(tenantSlug, conversationId);
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000);
  const now = new Date();
  await db.update(aiConversations).set({
    status: 'human',
    handoffReason: reason || 'Manual operator takeover',
    handoffAt: now,
    updatedAt: now,
  }).where(and(
    eq(aiConversations.id, conversation.id),
    eq(aiConversations.tenantId, tenant.id),
  ));
  await cancelEnterpriseAiScheduledActionsForConversation(conversation.id, tenant.id);
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/conversations`);
}

export async function resumeEnterpriseAiConversation(
  tenantSlug: string,
  conversationId: string,
) {
  const { tenant, conversation } = await requireConversation(tenantSlug, conversationId);
  const now = new Date();
  await db.update(aiConversations).set({
    status: 'automated',
    handoffReason: null,
    resumedAt: now,
    updatedAt: now,
  }).where(and(
    eq(aiConversations.id, conversation.id),
    eq(aiConversations.tenantId, tenant.id),
  ));
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/conversations`);
}

export async function sendEnterpriseAiHumanReply(
  tenantSlug: string,
  conversationId: string,
  formData: FormData,
) {
  const { tenant, conversation } = await requireConversation(tenantSlug, conversationId);
  if (conversation.status !== 'human') throw new Error('Take over this conversation before sending a human reply.');

  const text = String(formData.get('message') ?? '').trim().slice(0, 20_000);
  if (!text) throw new Error('Reply cannot be empty.');

  const connection = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.id, conversation.connectionId),
      eq(aiProviderConnections.tenantId, tenant.id),
      eq(aiProviderConnections.mode, 'channel'),
      eq(aiProviderConnections.status, 'active'),
    ),
  });
  if (!connection?.secretRef) throw new Error('Channel is not active.');
  const channel = channelFromProvider(connection.providerKey);
  if (!channel || !isEntitlementKey(channel.entitlement)) throw new Error('Channel is unavailable.');
  if (!(await hasEntitlement({ tenantId: tenant.id, entitlement: channel.entitlement as EntitlementKey }))) {
    throw new Error('Channel entitlement is inactive.');
  }

  const delivery = await deliverEnterpriseAiChannelMessage(
    {
      channel: channel.key,
      endpointUrl: connection.endpointUrl,
      metadata: connection.metadata,
      credentials: revealChannelCredentials(connection.secretRef),
    },
    {
      recipientId: conversation.replyRecipientId ?? conversation.externalUserId ?? conversation.externalConversationId,
      contextId: conversation.replyContextId ?? conversation.externalConversationId,
      text,
    },
  );

  await recordEnterpriseAiMessage({
    tenantId: tenant.id,
    conversationId: conversation.id,
    direction: 'outbound',
    role: 'assistant',
    providerMessageId: delivery.providerMessageId ?? null,
    content: text,
    metadata: { humanOperator: true },
  });
  await markEnterpriseAiConversationOutbound(conversation.id, tenant.id);
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/conversations`);
}
