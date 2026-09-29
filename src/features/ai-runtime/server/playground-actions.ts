'use server';

import { and, eq } from 'drizzle-orm';

import { runEnterpriseAiManagedChannelTurn } from '@/features/ai-runtime/channels/server/runtime';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections, aiSolutionInstances } from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export type EnterpriseAiPlaygroundState = {
  response?: string;
  requestId?: string;
  error?: string;
};

async function ensurePlaygroundConnection(tenantId: string) {
  const existing = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.tenantId, tenantId),
      eq(aiProviderConnections.providerKey, 'playground'),
      eq(aiProviderConnections.mode, 'playground'),
    ),
  });
  if (existing) {
    if (existing.status !== 'active') {
      await db.update(aiProviderConnections).set({
        status: 'active',
        updatedAt: new Date(),
      }).where(eq(aiProviderConnections.id, existing.id));
    }
    return existing;
  }

  const [created] = await db.insert(aiProviderConnections).values({
    tenantId,
    projectId: null,
    providerKey: 'playground',
    mode: 'playground',
    status: 'active',
    metadata: { surface: 'enterprise-ai-playground' },
  }).returning();
  if (!created) throw new Error('Playground connection could not be prepared.');
  return created;
}

export async function runEnterpriseAiPlayground(
  tenantSlug: string,
  _state: EnterpriseAiPlaygroundState,
  formData: FormData,
): Promise<EnterpriseAiPlaygroundState> {
  const actor = await requirePermission(tenantSlug, 'ai:agents:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: 'Workspace not found.' };
  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    return { error: 'Enterprise AI is not active for this workspace.' };
  }

  const solutionId = String(formData.get('solutionId') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim().slice(0, 20_000);
  if (!solutionId || !message) return { error: 'Choose a solution and enter a test message.' };

  const solution = await db.query.aiSolutionInstances.findFirst({
    where: and(
      eq(aiSolutionInstances.id, solutionId),
      eq(aiSolutionInstances.tenantId, tenant.id),
    ),
  });
  if (!solution) return { error: 'Selected solution is not available to this workspace.' };
  if (solution.status === 'disabled') return { error: 'Selected solution is disabled.' };

  const connection = await ensurePlaygroundConnection(tenant.id);
  const providerMessageId = crypto.randomUUID();

  try {
    const result = await runEnterpriseAiManagedChannelTurn({
      tenantId: tenant.id,
      projectId: solution.projectId,
      connectionId: connection.id,
      providerMessageId,
      senderId: actor.userId,
      externalConversationId: `playground:${solution.id}:${actor.userId}`,
      replyRecipientId: actor.userId,
      contextId: `playground:${solution.id}`,
      text: message,
      solutionInstanceId: solution.id,
      requestedModel: undefined,
      testMode: true,
    });

    if (result.kind === 'disabled') {
      return { error: 'Enterprise AI inference is currently disabled by the Mkety production safety gate.' };
    }
    if (result.kind === 'handoff') {
      return { error: 'This playground conversation is under human control. Resume AI in Conversations first.' };
    }
    if (result.kind === 'duplicate') {
      return { error: 'This test request was already processed.', requestId: result.requestId };
    }
    return {
      response: result.text,
      requestId: result.requestId,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Enterprise AI playground request failed.',
    };
  }
}
