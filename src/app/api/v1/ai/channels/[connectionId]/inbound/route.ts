import { and, eq } from 'drizzle-orm';

import { revealChannelCredentials } from '@/features/ai-runtime/channels/credentials';
import {
  verifyAndNormalizeEnterpriseAiInbound,
  verifyMetaWebhookChallenge,
} from '@/features/ai-runtime/channels/inbound';
import { getEnterpriseAiChannel, type EnterpriseAiChannelKey } from '@/features/ai-runtime/channels/registry';
import { runEnterpriseAiManagedChannelTurn } from '@/features/ai-runtime/channels/server/runtime';
import { deliverEnterpriseAiChannelMessage } from '@/features/ai-runtime/channels/transport';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { isEntitlementKey, type EntitlementKey } from '@/features/entitlements/entitlement-keys';
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
  if (!channel || !['whatsapp', 'instagram', 'facebook_messenger'].includes(channel.key)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const challenge = verifyMetaWebhookChallenge(new URL(request.url), revealChannelCredentials(connection.secretRef));
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
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

  let inbound;
  let credentials;
  try {
    credentials = revealChannelCredentials(connection.secretRef);
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
      providerMessageId: inbound.providerMessageId,
      senderId: inbound.senderId,
      text: inbound.text,
      requestedModel:
        typeof connection.metadata.modelAlias === 'string'
          ? connection.metadata.modelAlias
          : undefined,
    });

    if (turn.kind === 'completed' && turn.text) {
      await deliverEnterpriseAiChannelMessage(
        {
          channel: channel.key,
          endpointUrl: connection.endpointUrl,
          metadata: connection.metadata,
          credentials,
        },
        {
          recipientId: inbound.replyRecipientId,
          text: turn.text,
          replyToId: channel.key === 'telegram' ? inbound.providerMessageId : undefined,
        },
      );
    }

    // Duplicate provider webhook retries intentionally do not re-run AI.
    return Response.json({
      ok: true,
      request_id: turn.requestId ?? null,
      duplicate: turn.kind === 'duplicate',
      runtime_disabled: turn.kind === 'disabled',
    });
  } catch {
    // Do not reveal tenant/provider/accounting detail to external webhook callers.
    return Response.json({ ok: false, retryable: true }, { status: 503 });
  }
}
