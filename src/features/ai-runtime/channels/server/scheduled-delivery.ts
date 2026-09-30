import { and, eq } from 'drizzle-orm';

import { revealChannelCredentials } from '@/features/ai-runtime/channels/credentials';
import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import {
  claimEnterpriseAiScheduledAction,
  completeEnterpriseAiScheduledAction,
  type EnterpriseAiScheduledPayload,
  failEnterpriseAiScheduledAction,
  markEnterpriseAiConversationOutbound,
  markEnterpriseAiScheduledActionReconciliationRequired,
  recordEnterpriseAiMessage,
  scheduleEnterpriseAiAction,
} from '@/features/ai-runtime/channels/server/conversations';
import { deliverEnterpriseAiChannelMessage } from '@/features/ai-runtime/channels/transport';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { runEnterpriseAiManagedChannelTurn } from '@/features/ai-runtime/channels/server/runtime';
import { enqueueEnterpriseAiScheduledAction } from '@/features/ai-runtime/channels/server/delivery-queue';
import { getEnterpriseAiRuntimePolicy } from '@/features/ai-runtime/server/commercial-policy';
import { parseEnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solutions';
import { type EntitlementKey, isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import {
  aiConversations,
  aiProviderConnections,
  aiScheduledActions,
  aiSolutionInstances,
} from '@/shared/db/schema/ai-runtime';

function parseChannel(providerKey: string) {
  if (!providerKey.startsWith('channel:')) return null;
  return getEnterpriseAiChannel(providerKey.slice('channel:'.length) as EnterpriseAiChannelKey);
}

function payloadOf(value: Record<string, unknown>): EnterpriseAiScheduledPayload | null {
  const recipientId = typeof value.recipientId === 'string' ? value.recipientId.trim() : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!recipientId || !text) return null;
  return {
    recipientId,
    text: text.slice(0, 20_000),
    ...(typeof value.replyToId === 'string' && value.replyToId ? { replyToId: value.replyToId } : {}),
    ...(typeof value.contextId === 'string' && value.contextId ? { contextId: value.contextId } : {}),
    ...(typeof value.sourceProviderMessageId === 'string' && value.sourceProviderMessageId
      ? { sourceProviderMessageId: value.sourceProviderMessageId }
      : {}),
    ...(typeof value.commitment === 'string' && value.commitment
      ? { commitment: value.commitment.slice(0, 500) }
      : {}),
  };
}

async function cancelAction(id: string, tenantId: string, reason: string) {
  const now = new Date();
  await db.update(aiScheduledActions).set({
    status: 'cancelled',
    cancelledAt: now,
    claimUntil: null,
    lastError: reason.slice(0, 1000),
    updatedAt: now,
  }).where(and(eq(aiScheduledActions.id, id), eq(aiScheduledActions.tenantId, tenantId)));
}

export async function deliverEnterpriseAiScheduledActionById(input: {
  actionId: string;
  tenantId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const action = await db.query.aiScheduledActions.findFirst({
    where: and(
      eq(aiScheduledActions.id, input.actionId),
      eq(aiScheduledActions.tenantId, input.tenantId),
    ),
  });
  if (!action) return { ok: false as const, reason: 'not_found' as const };
  if (['sent', 'cancelled', 'failed', 'reconciliation_required'].includes(action.status)) {
    return { ok: true as const, duplicate: true as const, status: action.status };
  }
  if (action.dueAt.getTime() > now.getTime()) {
    return { ok: false as const, reason: 'not_due' as const, dueAt: action.dueAt };
  }

  const claimed = await claimEnterpriseAiScheduledAction(action.id, action.tenantId, now);
  if (!claimed) return { ok: true as const, duplicate: true as const, status: 'claimed' };

  let providerDispatchStarted = false;

  try {
    const runtimePolicy = await getEnterpriseAiRuntimePolicy();
    if (!runtimePolicy.customerInferenceEnabled) {
      await cancelAction(action.id, action.tenantId, 'enterprise_ai_global_inference_disabled');
      return { ok: true as const, cancelled: true as const, reason: 'runtime_disabled' as const };
    }

    if (!(await hasEnterpriseAiAccess(action.tenantId))) {
      await cancelAction(action.id, action.tenantId, 'enterprise_ai_entitlement_inactive');
      return { ok: true as const, cancelled: true as const, reason: 'entitlement_inactive' as const };
    }

    const connection = await db.query.aiProviderConnections.findFirst({
      where: and(
        eq(aiProviderConnections.id, action.connectionId),
        eq(aiProviderConnections.tenantId, action.tenantId),
        eq(aiProviderConnections.mode, 'channel'),
        eq(aiProviderConnections.status, 'active'),
      ),
    });
    if (!connection?.secretRef) {
      await cancelAction(action.id, action.tenantId, 'channel_inactive');
      return { ok: true as const, cancelled: true as const, reason: 'channel_inactive' as const };
    }

    const channel = parseChannel(connection.providerKey);
    if (!channel || !isEntitlementKey(channel.entitlement)) {
      await cancelAction(action.id, action.tenantId, 'channel_not_supported');
      return { ok: true as const, cancelled: true as const, reason: 'channel_not_supported' as const };
    }
    if (!(await hasEntitlement({
      tenantId: action.tenantId,
      entitlement: channel.entitlement as EntitlementKey,
    }))) {
      await cancelAction(action.id, action.tenantId, 'channel_entitlement_inactive');
      return { ok: true as const, cancelled: true as const, reason: 'channel_entitlement_inactive' as const };
    }

    if (action.conversationId) {
      const conversation = await db.query.aiConversations.findFirst({
        where: and(
          eq(aiConversations.id, action.conversationId),
          eq(aiConversations.tenantId, action.tenantId),
        ),
      });
      if (!conversation || conversation.status === 'human') {
        await cancelAction(action.id, action.tenantId, 'conversation_under_human_control');
        return { ok: true as const, cancelled: true as const, reason: 'human_control' as const };
      }
    }

    if (action.solutionInstanceId) {
      const solution = await db.query.aiSolutionInstances.findFirst({
        where: and(
          eq(aiSolutionInstances.id, action.solutionInstanceId),
          eq(aiSolutionInstances.tenantId, action.tenantId),
        ),
      });
      const configuration = parseEnterpriseAiSolutionConfiguration(solution?.configuration);
      if (!solution || solution.status === 'disabled' || configuration.paused) {
        await cancelAction(action.id, action.tenantId, 'solution_paused_or_disabled');
        return { ok: true as const, cancelled: true as const, reason: 'solution_disabled' as const };
      }
    }

    const rawPayload = action.payload as Record<string, unknown>;
    if (action.kind === 'inbound_retry') {
      const retry = rawPayload.inboundRetry;
      if (!retry || typeof retry !== 'object' || Array.isArray(retry)) {
        throw new Error('scheduled_inbound_retry_payload_invalid');
      }
      const value = retry as Record<string, unknown>;
      const originalProviderMessageId = typeof value.originalProviderMessageId === 'string' ? value.originalProviderMessageId : '';
      const senderId = typeof value.senderId === 'string' ? value.senderId : '';
      const externalConversationId = typeof value.externalConversationId === 'string' ? value.externalConversationId : '';
      const replyRecipientId = typeof value.replyRecipientId === 'string' ? value.replyRecipientId : '';
      const inboundText = typeof rawPayload.text === 'string' ? rawPayload.text : '';
      if (!originalProviderMessageId || !senderId || !externalConversationId || !replyRecipientId || !inboundText) {
        throw new Error('scheduled_inbound_retry_payload_invalid');
      }

      const turn = await runEnterpriseAiManagedChannelTurn({
        tenantId: action.tenantId,
        projectId: connection.projectId,
        connectionId: connection.id,
        channelKey: channel.key,
        providerMessageId: `${originalProviderMessageId}:retry:${claimed.attempts}`,
        senderId,
        externalConversationId,
        replyRecipientId,
        replyToId: typeof value.replyToId === 'string' ? value.replyToId : undefined,
        contextId: typeof value.contextId === 'string' ? value.contextId : externalConversationId,
        text: inboundText,
        solutionInstanceId: action.solutionInstanceId,
        requestedModel: typeof value.requestedModel === 'string' ? value.requestedModel : undefined,
        skipInboundRecord: true,
      });

      if (turn.kind === 'completed' && turn.text) {
        const reply = await scheduleEnterpriseAiAction({
          tenantId: action.tenantId,
          conversationId: turn.conversationId,
          solutionInstanceId: action.solutionInstanceId,
          connectionId: connection.id,
          kind: 'delayed_reply',
          idempotencyKey: `reply:${connection.id}:${originalProviderMessageId}`,
          dueAt: new Date(Date.now() + turn.deliveryDelaySeconds * 1_000),
          payload: {
            recipientId: replyRecipientId,
            replyToId: typeof value.replyToId === 'string' ? value.replyToId : undefined,
            contextId: typeof value.contextId === 'string' ? value.contextId : externalConversationId,
            text: turn.text,
            sourceProviderMessageId: originalProviderMessageId,
          },
        });
        await enqueueEnterpriseAiScheduledAction({
          actionId: reply.id,
          tenantId: action.tenantId,
          delaySeconds: turn.deliveryDelaySeconds,
        }).catch(() => ({ queued: false as const, reason: 'queue_failed' as const }));
      }

      await completeEnterpriseAiScheduledAction(action.id, action.tenantId);
      return { ok: true as const, retried: true as const, result: turn.kind };
    }

    const payload = payloadOf(rawPayload);
    if (!payload) throw new Error('scheduled_payload_invalid');

    const credentials = revealChannelCredentials(connection.secretRef);
    providerDispatchStarted = true;
    const delivery = await deliverEnterpriseAiChannelMessage(
      {
        channel: channel.key,
        endpointUrl: connection.endpointUrl,
        metadata: connection.metadata,
        credentials,
      },
      {
        recipientId: payload.recipientId,
        text: payload.text,
        replyToId: payload.replyToId,
        contextId: payload.contextId,
      },
    );

    if (action.conversationId) {
      await recordEnterpriseAiMessage({
        tenantId: action.tenantId,
        conversationId: action.conversationId,
        direction: 'outbound',
        role: 'assistant',
        providerMessageId: delivery.providerMessageId ?? null,
        content: payload.text,
        metadata: {
          scheduledActionId: action.id,
          scheduledActionKind: action.kind,
          rawStatus: delivery.rawStatus ?? null,
        },
      });
      await markEnterpriseAiConversationOutbound(action.conversationId, action.tenantId);
    }

    await completeEnterpriseAiScheduledAction(action.id, action.tenantId);
    return { ok: true as const, delivered: true as const };
  } catch (error) {
    const attempts = Number(claimed.attempts ?? 1);
    const message = error instanceof Error ? error.message : 'scheduled_delivery_failed';

    if (providerDispatchStarted) {
      await markEnterpriseAiScheduledActionReconciliationRequired(
        action.id,
        action.tenantId,
        message,
      );
    } else {
      await failEnterpriseAiScheduledAction(
        action.id,
        action.tenantId,
        attempts,
        action.maxAttempts,
        message,
      );
    }
    throw error;
  }
}
