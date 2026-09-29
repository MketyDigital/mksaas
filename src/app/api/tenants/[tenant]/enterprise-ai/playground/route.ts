import { and, eq } from 'drizzle-orm';

import {
  markEnterpriseAiConversationOutbound,
  recordEnterpriseAiMessage,
} from '@/features/ai-runtime/channels/server/conversations';
import { runEnterpriseAiManagedChannelTurn } from '@/features/ai-runtime/channels/server/runtime';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections, aiSolutionInstances } from '@/shared/db/schema/ai-runtime';
import { auth } from '@/shared/lib/auth';
import { hasPermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function POST(request: Request, context: { params: Promise<{ tenant: string }> }) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });

  const { tenant: tenantSlug } = await context.params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return Response.json({ ok: false, message: 'Workspace not found.' }, { status: 404 });
  if (!(await hasPermission(tenantSlug, 'ai:agents:manage'))) {
    return Response.json({ ok: false, message: 'Forbidden.' }, { status: 403 });
  }
  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    return Response.json({ ok: false, message: 'Enterprise AI is not active.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { solutionId?: string; message?: string } | null;
  const solutionId = String(body?.solutionId ?? '');
  const message = String(body?.message ?? '').trim().slice(0, 20_000);
  if (!solutionId || !message) {
    return Response.json({ ok: false, message: 'Choose a solution and enter a test message.' }, { status: 400 });
  }

  const solution = await db.query.aiSolutionInstances.findFirst({
    where: and(
      eq(aiSolutionInstances.id, solutionId),
      eq(aiSolutionInstances.tenantId, tenant.id),
    ),
  });
  if (!solution) return Response.json({ ok: false, message: 'Solution not found.' }, { status: 404 });

  const providerKey = `playground:${solution.id}`;
  let connection = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.tenantId, tenant.id),
      eq(aiProviderConnections.providerKey, providerKey),
      eq(aiProviderConnections.mode, 'playground'),
    ),
  });
  if (!connection) {
    const [created] = await db.insert(aiProviderConnections).values({
      tenantId: tenant.id,
      projectId: solution.projectId,
      providerKey,
      mode: 'playground',
      status: 'active',
      metadata: { solutionInstanceId: solution.id, internalPlayground: true },
    }).returning();
    connection = created ?? await db.query.aiProviderConnections.findFirst({
      where: and(
        eq(aiProviderConnections.tenantId, tenant.id),
        eq(aiProviderConnections.providerKey, providerKey),
        eq(aiProviderConnections.mode, 'playground'),
      ),
    });
  }
  if (!connection) return Response.json({ ok: false, message: 'Playground could not initialize.' }, { status: 500 });

  try {
    const providerMessageId = `playground-${crypto.randomUUID()}`;
    const conversationKey = `playground:${solution.id}:${session.user.id}`;
    const turn = await runEnterpriseAiManagedChannelTurn({
      tenantId: tenant.id,
      projectId: solution.projectId,
      connectionId: connection.id,
      providerMessageId,
      senderId: session.user.id,
      externalConversationId: conversationKey,
      replyRecipientId: session.user.id,
      contextId: conversationKey,
      text: message,
      solutionInstanceId: solution.id,
      testMode: true,
    });

    if (turn.kind === 'disabled') {
      return Response.json({ ok: false, message: 'Enterprise AI production inference is currently disabled.' }, { status: 423 });
    }
    if (turn.kind === 'handoff') {
      return Response.json({ ok: false, message: 'This playground conversation is under human takeover.' }, { status: 409 });
    }
    if (turn.kind === 'duplicate') {
      return Response.json({ ok: false, message: 'Duplicate playground request.' }, { status: 409 });
    }

    await recordEnterpriseAiMessage({
      tenantId: tenant.id,
      conversationId: turn.conversationId,
      requestId: turn.requestId,
      direction: 'outbound',
      role: 'assistant',
      content: turn.text,
      metadata: { playground: true },
    });
    await markEnterpriseAiConversationOutbound(turn.conversationId, tenant.id);

    return Response.json({
      ok: true,
      requestId: turn.requestId,
      text: turn.text,
      reminderScheduled: false,
      deliveryDelaySeconds: 0,
    });
  } catch {
    return Response.json({ ok: false, message: 'The test request could not be completed safely.' }, { status: 503 });
  }
}
