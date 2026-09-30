import { and, eq } from 'drizzle-orm';
import { waitUntil } from 'cloudflare:workers';

import { revealChannelCredentials } from '@/features/ai-runtime/channels/credentials';
import {
  normalizeDiscordInteraction,
  verifyAndExtractLinkedInCommunityNotifications,
  verifyAndNormalizeEnterpriseAiInbound,
  verifyDiscordInteraction,
  verifyLinkedInWebhookChallenge,
  verifyMetaWebhookChallenge,
} from '@/features/ai-runtime/channels/inbound';
import { resolveLinkedInCommunityNotification } from '@/features/ai-runtime/channels/linkedin-community';
import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import {
  markEnterpriseAiConversationOutbound,
  recordEnterpriseAiMessage,
  scheduleEnterpriseAiAction,
} from '@/features/ai-runtime/channels/server/conversations';
import { enqueueEnterpriseAiScheduledAction } from '@/features/ai-runtime/channels/server/delivery-queue';
import { runEnterpriseAiManagedChannelTurn } from '@/features/ai-runtime/channels/server/runtime';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { type EntitlementKey, isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections } from '@/shared/db/schema/ai-runtime';

export const dynamic = 'force-dynamic';

function parseChannel(providerKey: string) {
  if (!providerKey.startsWith('channel:')) return null;
  const key = providerKey.slice('channel:'.length) as EnterpriseAiChannelKey;
  return getEnterpriseAiChannel(key);
}

async function getConnection(connectionId: string) {
  return db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.id, connectionId),
      eq(aiProviderConnections.mode, 'channel'),
      eq(aiProviderConnections.status, 'active'),
    ),
  });
}

async function authorizeConnection(connection: NonNullable<Awaited<ReturnType<typeof getConnection>>>) {
  if (!connection.tenantId) return false;
  const channel = parseChannel(connection.providerKey);
  if (!channel || !isEntitlementKey(channel.entitlement)) return false;
  const [enterprise, channelAccess] = await Promise.all([
    hasEnterpriseAiAccess(connection.tenantId),
    hasEntitlement({
      tenantId: connection.tenantId,
      entitlement: channel.entitlement as EntitlementKey,
    }),
  ]);
  return enterprise && channelAccess ? channel : false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;
  const connection = await getConnection(connectionId);
  if (!connection?.secretRef) return new Response('Not found', { status: 404 });

  const channel = await authorizeConnection(connection);
  if (!channel) return new Response('Not found', { status: 404 });

  try {
    const credentials = revealChannelCredentials(connection.secretRef);
    const url = new URL(request.url);

    if (['whatsapp', 'instagram', 'facebook_messenger'].includes(channel.key)) {
      const challenge = verifyMetaWebhookChallenge(url, credentials);
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (channel.key === 'linkedin_page') {
      return Response.json(verifyLinkedInWebhookChallenge(url, credentials));
    }

    return new Response('Not found', { status: 404 });
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;
  const connection = await getConnection(connectionId);
  if (!connection?.tenantId || !connection.secretRef) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const channel = await authorizeConnection(connection);
  if (!channel || !channel.supportsInbound) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 1_000_000) {
    return Response.json({ ok: false }, { status: 413 });
  }

  const credentials = revealChannelCredentials(connection.secretRef);

  if (channel.key === 'discord') {
    let payload: Record<string, unknown>;
    try {
      verifyDiscordInteraction(rawBody, request.headers, credentials);
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return Response.json({ ok: false }, { status: 401 });
    }

    if (payload.type === 1) return Response.json({ type: 1 });

    let inbound;
    try {
      inbound = normalizeDiscordInteraction(payload);
    } catch {
      return Response.json({
        type: 4,
        data: { content: 'Send your question with the configured AI command.', flags: 64 },
      });
    }

    const applicationId = String(payload.application_id ?? '');
    const interactionToken = String(payload.token ?? '');
    if (!applicationId || !interactionToken) {
      return Response.json({ ok: false }, { status: 400 });
    }

    waitUntil((async () => {
      try {
        const turn = await runEnterpriseAiManagedChannelTurn({
          tenantId: connection.tenantId!,
          projectId: connection.projectId,
          connectionId: connection.id,
          channelKey: channel.key,
          providerMessageId: inbound.providerMessageId,
          senderId: inbound.senderId,
          externalConversationId: inbound.conversationId,
          replyRecipientId: inbound.replyRecipientId,
          contextId: inbound.conversationId,
          replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
          text: inbound.text,
          attachments: inbound.attachments,
          solutionInstanceId:
            typeof connection.metadata.solutionInstanceId === 'string'
              ? connection.metadata.solutionInstanceId
              : null,
          requestedModel:
            typeof connection.metadata.modelAlias === 'string'
              ? connection.metadata.modelAlias
              : undefined,
        });
        if (turn.kind !== 'completed' || !turn.text) return;
        const delivery = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: turn.text, allowed_mentions: { parse: [] } }),
        });
        if (!delivery.ok) throw new Error('Discord follow-up delivery failed.');
        await recordEnterpriseAiMessage({
          tenantId: connection.tenantId!,
          conversationId: turn.conversationId,
          requestId: turn.requestId,
          direction: 'outbound',
          role: 'assistant',
          content: turn.text,
          metadata: { channel: 'discord' },
        });
        await markEnterpriseAiConversationOutbound(turn.conversationId, connection.tenantId!);
      } catch {
        await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'The AI request could not be completed safely.' }),
        }).catch(() => undefined);
      }
    })());

    return Response.json({ type: 5 });
  }

  if (channel.key === 'linkedin_page') {
    let notifications;
    try {
      notifications = verifyAndExtractLinkedInCommunityNotifications({
        rawBody,
        headers: request.headers,
        credentials,
      });
    } catch {
      return Response.json({ ok: false }, { status: 401 });
    }

    const version =
      typeof connection.metadata.linkedinVersion === 'string'
        ? connection.metadata.linkedinVersion
        : '202609';

    for (const notification of notifications) {
      waitUntil((async () => {
        const inbound = await resolveLinkedInCommunityNotification({
          notification,
          credentials,
          version,
        });
        if (!inbound) return;
        const turn = await runEnterpriseAiManagedChannelTurn({
          tenantId: connection.tenantId!,
          projectId: connection.projectId,
          connectionId: connection.id,
          channelKey: channel.key,
          providerMessageId: inbound.providerMessageId,
          senderId: inbound.senderId,
          externalConversationId: inbound.conversationId,
          replyRecipientId: inbound.replyRecipientId,
          contextId: inbound.conversationId,
          replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
          text: inbound.text,
          attachments: inbound.attachments,
          solutionInstanceId:
            typeof connection.metadata.solutionInstanceId === 'string'
              ? connection.metadata.solutionInstanceId
              : null,
          requestedModel:
            typeof connection.metadata.modelAlias === 'string'
              ? connection.metadata.modelAlias
              : undefined,
        });
        if (turn.kind === 'completed' && turn.text) {
          const action = await scheduleEnterpriseAiAction({
            tenantId: connection.tenantId!,
            conversationId: turn.conversationId,
            solutionInstanceId:
              typeof connection.metadata.solutionInstanceId === 'string'
                ? connection.metadata.solutionInstanceId
                : null,
            connectionId: connection.id,
            kind: 'delayed_reply',
            idempotencyKey: `reply:${connection.id}:${inbound.providerMessageId}`,
            dueAt: new Date(Date.now() + turn.deliveryDelaySeconds * 1_000),
            payload: {
              recipientId: inbound.replyRecipientId,
              contextId: inbound.conversationId,
              text: turn.text,
              sourceProviderMessageId: inbound.providerMessageId,
            },
          });
          await enqueueEnterpriseAiScheduledAction({
            actionId: action.id,
            tenantId: connection.tenantId!,
            delaySeconds: turn.deliveryDelaySeconds,
          }).catch(() => ({ queued: false as const, reason: 'queue_failed' as const }));
        }
      })().catch(() => undefined));
    }

    return Response.json({ ok: true, accepted: notifications.length }, { status: 202 });
  }

  let inbound;
  try {
    inbound = verifyAndNormalizeEnterpriseAiInbound({
      channel: channel.key,
      rawBody,
      headers: request.headers,
      credentials,
    });
  } catch {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const turn = await runEnterpriseAiManagedChannelTurn({
      tenantId: connection.tenantId,
      projectId: connection.projectId,
      connectionId: connection.id,
      channelKey: channel.key,
      providerMessageId: inbound.providerMessageId,
      senderId: inbound.senderId,
      externalConversationId: inbound.conversationId,
      replyRecipientId: inbound.replyRecipientId,
      contextId: inbound.conversationId,
      replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
      text: inbound.text,
      attachments: inbound.attachments,
      solutionInstanceId:
        typeof connection.metadata.solutionInstanceId === 'string'
          ? connection.metadata.solutionInstanceId
          : null,
      requestedModel:
        typeof connection.metadata.modelAlias === 'string'
          ? connection.metadata.modelAlias
          : undefined,
    });

    if (turn.kind === 'completed' && turn.text) {
      const action = await scheduleEnterpriseAiAction({
        tenantId: connection.tenantId,
        conversationId: turn.conversationId,
        solutionInstanceId:
          typeof connection.metadata.solutionInstanceId === 'string'
            ? connection.metadata.solutionInstanceId
            : null,
        connectionId: connection.id,
        kind: 'delayed_reply',
        idempotencyKey: `reply:${connection.id}:${inbound.providerMessageId}`,
        dueAt: new Date(Date.now() + turn.deliveryDelaySeconds * 1_000),
        payload: {
          recipientId: inbound.replyRecipientId,
          replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
          contextId: inbound.conversationId,
          text: turn.text,
          sourceProviderMessageId: inbound.providerMessageId,
        },
      });
      await enqueueEnterpriseAiScheduledAction({
        actionId: action.id,
        tenantId: connection.tenantId,
        delaySeconds: turn.deliveryDelaySeconds,
      }).catch(() => ({ queued: false as const, reason: 'queue_failed' as const }));
    }

    // Duplicate provider webhook retries intentionally do not re-run AI.
    return Response.json({
      ok: true,
      request_id: 'requestId' in turn ? turn.requestId ?? null : null,
      duplicate: turn.kind === 'duplicate',
      runtime_disabled: turn.kind === 'disabled',
      human_handoff: turn.kind === 'handoff',
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
    const conversationId = error && typeof error === 'object' && 'conversationId' in error
      ? String((error as { conversationId?: unknown }).conversationId ?? '')
      : '';

    if (code === 'ENTERPRISE_AI_PROVIDER_CAPACITY_RETRYABLE') {
      const action = await scheduleEnterpriseAiAction({
        tenantId: connection.tenantId,
        conversationId: conversationId || null,
        solutionInstanceId:
          typeof connection.metadata.solutionInstanceId === 'string'
            ? connection.metadata.solutionInstanceId
            : null,
        connectionId: connection.id,
        kind: 'inbound_retry',
        idempotencyKey: `inbound-retry:${connection.id}:${inbound.providerMessageId}`,
        dueAt: new Date(Date.now() + 30_000),
        payload: {
          recipientId: inbound.replyRecipientId,
          contextId: inbound.conversationId,
          replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
          text: inbound.text,
          attachments: inbound.attachments ?? [],
          sourceProviderMessageId: inbound.providerMessageId,
          inboundRetry: {
            originalProviderMessageId: inbound.providerMessageId,
            senderId: inbound.senderId,
            externalConversationId: inbound.conversationId,
            replyRecipientId: inbound.replyRecipientId,
            replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
            contextId: inbound.conversationId,
            requestedModel:
              typeof connection.metadata.modelAlias === 'string'
                ? connection.metadata.modelAlias
                : undefined,
          },
        },
      });
      await enqueueEnterpriseAiScheduledAction({
        actionId: action.id,
        tenantId: connection.tenantId,
        delaySeconds: 30,
      }).catch(() => ({ queued: false as const, reason: 'queue_failed' as const }));
      return Response.json({ ok: true, queued_retry: true }, { status: 202 });
    }

    // Do not reveal tenant/provider/accounting detail to external webhook callers.
    return Response.json({ ok: false, retryable: true }, { status: 503 });
  }
}
