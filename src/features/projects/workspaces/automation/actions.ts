'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireProjectAccess } from '@/features/projects/server/access';
import { db } from '@/shared/db';
import { workflows } from '@/shared/db/schema';

import { buildWorkflowDraftInput } from './workflow-drafts';
import { buildWorkflowMetadataUpdateInput } from './workflow-edit-drafts';
import { buildWorkflowDefinitionWithDraftNode } from './workflow-node-drafts';

export async function createAutomationWorkflowDraft(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    throw new Error(access.reason);
  }

  if (!access.canManage) {
    throw new Error('You do not have permission to create automation workflows.');
  }

  const draft = buildWorkflowDraftInput({
    description: String(formData.get('description') || ''),
    name: String(formData.get('name') || ''),
    projectId: access.project.id,
    tenantId: access.tenant.id,
  });

  const existing = await db.query.workflows.findFirst({
    where: and(eq(workflows.projectId, access.project.id), eq(workflows.slug, draft.slug)),
  });

  if (existing) {
    throw new Error('That workflow slug is already in use in this project.');
  }

  await db.insert(workflows).values(draft);
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${draft.slug}`);
}

export async function updateAutomationWorkflowMetadata(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const workflowSlug = String(formData.get('workflowSlug') || '');
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    throw new Error(access.reason);
  }

  if (!access.canManage) {
    throw new Error('You do not have permission to edit automation workflows.');
  }

  if (!workflowSlug) {
    throw new Error('Workflow slug is required.');
  }

  const update = buildWorkflowMetadataUpdateInput({
    description: String(formData.get('description') || ''),
    name: String(formData.get('name') || ''),
  });

  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.slug, workflowSlug)),
  });

  if (!workflow) {
    throw new Error('Workflow not found.');
  }

  await db
    .update(workflows)
    .set({
      description: update.description,
      name: update.name,
      updatedAt: new Date(),
    })
    .where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}

export async function addAutomationWorkflowDraftNode(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const workflowSlug = String(formData.get('workflowSlug') || '');
  const nodeType = String(formData.get('nodeType') || '');
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    throw new Error(access.reason);
  }

  if (!access.canManage) {
    throw new Error('You do not have permission to edit automation workflow nodes.');
  }

  if (!workflowSlug) {
    throw new Error('Workflow slug is required.');
  }

  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.slug, workflowSlug)),
  });

  if (!workflow) {
    throw new Error('Workflow not found.');
  }

  const definition = buildWorkflowDefinitionWithDraftNode({
    currentDefinition: workflow.definition,
    nodeType,
  });

  await db
    .update(workflows)
    .set({
      definition,
      updatedAt: new Date(),
    })
    .where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}
