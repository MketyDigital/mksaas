'use server';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { db } from '@/shared/db/cloudflare';
import {
  aiConversations,
  aiProviderConnections,
  aiScheduledActions,
  aiSolutionInstances,
} from '@/shared/db/schema/ai-runtime';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function listEnterpriseAiCommitmentReminders(tenantId: string, limit = 200) {
  const rows = await db
    .select({
      id: aiScheduledActions.id,
      conversationId: aiScheduledActions.conversationId,
      solutionId: aiScheduledActions.solutionInstanceId,
      solutionName: aiSolutionInstances.name,
      providerKey: aiProviderConnections.providerKey,
      externalUserId: aiConversations.externalUserId,
      externalConversationId: aiConversations.externalConversationId,
      status: aiScheduledActions.status,
      dueAt: aiScheduledActions.dueAt,
      attempts: aiScheduledActions.attempts,
      maxAttempts: aiScheduledActions.maxAttempts,
      payload: aiScheduledActions.payload,
      lastError: aiScheduledActions.lastError,
      completedAt: aiScheduledActions.completedAt,
      cancelledAt: aiScheduledActions.cancelledAt,
      createdAt: aiScheduledActions.createdAt,
      updatedAt: aiScheduledActions.updatedAt,
    })
    .from(aiScheduledActions)
    .leftJoin(aiConversations, eq(aiScheduledActions.conversationId, aiConversations.id))
    .leftJoin(aiSolutionInstances, eq(aiScheduledActions.solutionInstanceId, aiSolutionInstances.id))
    .leftJoin(aiProviderConnections, eq(aiScheduledActions.connectionId, aiProviderConnections.id))
    .where(and(
      eq(aiScheduledActions.tenantId, tenantId),
      eq(aiScheduledActions.kind, 'commitment_reminder'),
    ))
    .orderBy(desc(aiScheduledActions.dueAt))
    .limit(Math.max(1, Math.min(500, limit)));

  return rows.map((row) => {
    const commitment = typeof row.payload.commitment === 'string' ? row.payload.commitment : '';
    const reminderText = typeof row.payload.text === 'string' ? row.payload.text : '';
    const sourceQuote = typeof row.payload.sourceQuote === 'string' ? row.payload.sourceQuote : '';
    return {
      ...row,
      commitment,
      reminderText,
      sourceQuote,
      channel: row.providerKey?.startsWith('channel:')
        ? row.providerKey.slice('channel:'.length)
        : row.providerKey ?? 'channel',
      customer: row.externalUserId ?? row.externalConversationId ?? 'Customer',
    };
  });
}

export async function cancelEnterpriseAiCommitmentReminder(
  tenantSlug: string,
  formData: FormData,
) {
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEnterpriseAiAccess(tenant.id))) throw new Error('Enterprise AI is not active.');

  const reminderId = String(formData.get('reminderId') ?? '').trim();
  if (!reminderId) throw new Error('Reminder is required.');

  const now = new Date();
  await db.update(aiScheduledActions).set({
    status: 'cancelled',
    cancelledAt: now,
    claimUntil: null,
    lastError: 'cancelled_by_workspace_operator',
    updatedAt: now,
  }).where(and(
    eq(aiScheduledActions.id, reminderId),
    eq(aiScheduledActions.tenantId, tenant.id),
    eq(aiScheduledActions.kind, 'commitment_reminder'),
    inArray(aiScheduledActions.status, ['pending', 'claimed']),
  ));

  revalidatePath(`/app/${tenantSlug}/enterprise-ai/reminders`);
}
