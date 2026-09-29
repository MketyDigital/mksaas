'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { parseEnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solutions';
import { db } from '@/shared/db/cloudflare';
import { projects } from '@/shared/db/schema';
import { aiSolutionInstances, aiSolutionTemplates } from '@/shared/db/schema/ai-runtime';
import { requirePermission, requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function createEnterpriseAiSolutionInstance(
  tenantSlug: string,
  formData: FormData,
) {
  const actor = await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace was not found.');
  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    throw new Error('Enterprise AI is not active for this workspace.');
  }

  const templateKey = String(formData.get('templateKey') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const projectId = String(formData.get('projectId') ?? '').trim() || null;
  if (!templateKey || !name || name.length > 160) throw new Error('A valid solution and name are required.');

  const template = await db.query.aiSolutionTemplates.findFirst({
    where: and(eq(aiSolutionTemplates.key, templateKey), eq(aiSolutionTemplates.enabled, true)),
    columns: { key: true },
  });
  if (!template) throw new Error('This business solution is not currently available.');

  if (projectId) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.tenantId, tenant.id)),
      columns: { id: true },
    });
    if (!project) throw new Error('Selected project is not available to this workspace.');
  }

  const [instance] = await db.insert(aiSolutionInstances).values({
    tenantId: tenant.id,
    projectId,
    templateKey,
    name,
    status: 'draft',
    configuration: {},
    createdByUserId: actor.userId,
  }).returning({ id: aiSolutionInstances.id });

  if (!instance) throw new Error('Solution setup could not be created.');
  redirect(`/t/${tenantSlug}/enterprise-ai/solutions/${instance.id}`);
}


function boundedText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? '').trim();
  if (value.length > maxLength) throw new Error(`${key} is too long.`);
  return value;
}

export async function updateEnterpriseAiSolutionConfiguration(
  tenantSlug: string,
  solutionId: string,
  formData: FormData,
) {
  await requirePermission(tenantSlug, 'ai:agents:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace was not found.');
  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    throw new Error('Enterprise AI is not active for this workspace.');
  }

  const instance = await db.query.aiSolutionInstances.findFirst({
    where: and(
      eq(aiSolutionInstances.id, solutionId),
      eq(aiSolutionInstances.tenantId, tenant.id),
    ),
  });
  if (!instance) throw new Error('AI solution was not found.');

  const existing = parseEnterpriseAiSolutionConfiguration(instance.configuration);
  const systemPrompt = boundedText(formData, 'systemPrompt', 40_000);
  const knowledgeText = boundedText(formData, 'knowledgeText', 120_000);
  const defaultModelAlias = boundedText(formData, 'defaultModelAlias', 128) || 'mkety-economy';
  const paused = formData.get('paused') === 'on';
  const statusValue = String(formData.get('status') ?? instance.status);
  const status = ['draft', 'active', 'disabled'].includes(statusValue) ? statusValue : instance.status;

  await db
    .update(aiSolutionInstances)
    .set({
      status,
      configuration: {
        ...instance.configuration,
        ...existing,
        systemPrompt,
        knowledgeText,
        defaultModelAlias,
        paused,
      },
      updatedAt: new Date(),
    })
    .where(and(
      eq(aiSolutionInstances.id, solutionId),
      eq(aiSolutionInstances.tenantId, tenant.id),
    ));

  revalidatePath(`/t/${tenantSlug}/enterprise-ai`);
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/solutions/${solutionId}`);
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/channels`);
}
