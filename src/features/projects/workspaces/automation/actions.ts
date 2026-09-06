'use server';

import { and, eq, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { requireProjectAccess } from '@/features/projects/server/access';
import { db } from '@/shared/db';
import { workflowRuns, workflows } from '@/shared/db/schema';

import { assertManualRunPreflightReady, buildManualRunInternalOutput } from './manual-run-foundation';
import { buildWorkflowDraftInput } from './workflow-drafts';
import { buildWorkflowMetadataUpdateInput } from './workflow-edit-drafts';
import { buildWorkflowDefinitionWithNodeConfigDraft } from './workflow-node-config-drafts';
import { buildWorkflowDefinitionWithDraftNode } from './workflow-node-drafts';
import { buildWorkflowDefinitionWithNodeStructureDraft, type WorkflowNodeStructureDraftOperation } from './workflow-node-structure-drafts';
import { validateAutomationWorkflowDefinition } from './workflow-preflight';

async function getManageableWorkflow(formData: FormData, permissionMessage: string) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const workflowSlug = String(formData.get('workflowSlug') || '');
  const access = await requireProjectAccess({ projectSlug, tenantSlug });
  if (access.status !== 'ok') throw new Error(access.reason);
  if (!access.canManage) throw new Error(permissionMessage);
  if (!workflowSlug) throw new Error('Workflow slug is required.');
  const workflow = await db.query.workflows.findFirst({ where: and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.slug, workflowSlug)) });
  if (!workflow) throw new Error('Workflow not found.');
  return { access, workflow };
}

export async function createAutomationWorkflowDraft(formData: FormData) {
  const tenantSlug = String(formData.get('tenantSlug') || '');
  const projectSlug = String(formData.get('projectSlug') || '');
  const access = await requireProjectAccess({ projectSlug, tenantSlug });
  if (access.status !== 'ok') throw new Error(access.reason);
  if (!access.canManage) throw new Error('You do not have permission to create automation workflows.');

  const draft = buildWorkflowDraftInput({ description: String(formData.get('description') || ''), name: String(formData.get('name') || ''), projectId: access.project.id, tenantId: access.tenant.id });
  const existing = await db.query.workflows.findFirst({ where: and(eq(workflows.projectId, access.project.id), eq(workflows.slug, draft.slug)) });
  if (existing) throw new Error('That workflow slug is already in use in this project.');
  await db.insert(workflows).values(draft);
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${draft.slug}`);
}

export async function updateAutomationWorkflowMetadata(formData: FormData) {
  const { access, workflow } = await getManageableWorkflow(formData, 'You do not have permission to edit automation workflows.');
  const update = buildWorkflowMetadataUpdateInput({ description: String(formData.get('description') || ''), name: String(formData.get('name') || '') });
  await db.update(workflows).set({ description: update.description, name: update.name, updatedAt: new Date() }).where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}

export async function addAutomationWorkflowDraftNode(formData: FormData) {
  const nodeType = String(formData.get('nodeType') || '');
  const { access, workflow } = await getManageableWorkflow(formData, 'You do not have permission to edit automation workflow nodes.');
  const definition = buildWorkflowDefinitionWithDraftNode({ currentDefinition: workflow.definition, nodeType });
  await db.update(workflows).set({ definition, updatedAt: new Date() }).where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}

export async function updateAutomationWorkflowNodeConfigDraft(formData: FormData) {
  const nodeId = String(formData.get('nodeId') || '');
  const { access, workflow } = await getManageableWorkflow(formData, 'You do not have permission to edit automation workflow node configuration.');
  const definition = buildWorkflowDefinitionWithNodeConfigDraft({ currentDefinition: workflow.definition, nodeId, label: String(formData.get('label') || ''), notes: String(formData.get('notes') || ''), triggerMode: String(formData.get('triggerMode') || ''), agentId: String(formData.get('agentId') || ''), prompt: String(formData.get('prompt') || ''), method: String(formData.get('method') || ''), url: String(formData.get('url') || ''), headers: String(formData.get('headers') || ''), body: String(formData.get('body') || ''), input: String(formData.get('input') || ''), mapping: String(formData.get('mapping') || ''), field: String(formData.get('field') || ''), operator: String(formData.get('operator') || ''), value: String(formData.get('value') || '') });
  await db.update(workflows).set({ definition, updatedAt: new Date() }).where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}

export async function updateAutomationWorkflowNodeStructureDraft(formData: FormData) {
  const nodeId = String(formData.get('nodeId') || '');
  const operation = String(formData.get('operation') || '') as WorkflowNodeStructureDraftOperation;
  const { access, workflow } = await getManageableWorkflow(formData, 'You do not have permission to edit automation workflow structure.');
  const definition = buildWorkflowDefinitionWithNodeStructureDraft({ currentDefinition: workflow.definition, nodeId, operation });
  await db.update(workflows).set({ definition, updatedAt: new Date() }).where(and(eq(workflows.tenantId, access.tenant.id), eq(workflows.projectId, access.project.id), eq(workflows.id, workflow.id)));
  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}

export async function startAutomationWorkflowManualRun(formData: FormData) {
  const { access, workflow } = await getManageableWorkflow(formData, 'You do not have permission to start automation workflow runs.');
  const preflight = validateAutomationWorkflowDefinition(workflow.definition);
  assertManualRunPreflightReady(preflight);

  const existingRun = await db.query.workflowRuns.findFirst({
    where: and(
      eq(workflowRuns.tenantId, access.tenant.id),
      eq(workflowRuns.projectId, access.project.id),
      eq(workflowRuns.workflowId, workflow.id),
      or(eq(workflowRuns.status, 'queued'), eq(workflowRuns.status, 'running')),
    ),
  });
  if (existingRun) throw new Error('This workflow already has a manual run in progress.');

  const input: Record<string, unknown> = {};
  const [run] = await db
    .insert(workflowRuns)
    .values({ tenantId: access.tenant.id, projectId: access.project.id, workflowId: workflow.id, triggerType: 'manual', input, status: 'queued' })
    .returning();
  if (!run) throw new Error('Manual workflow run could not be created.');

  const runScope = and(eq(workflowRuns.id, run.id), eq(workflowRuns.tenantId, access.tenant.id), eq(workflowRuns.projectId, access.project.id), eq(workflowRuns.workflowId, workflow.id));

  try {
    await db.update(workflowRuns).set({ status: 'running' }).where(runScope);
    const output = buildManualRunInternalOutput({ definition: workflow.definition, input, workflowVersion: workflow.version });
    await db.update(workflowRuns).set({ status: 'completed', output, completedAt: new Date() }).where(runScope);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Manual workflow run failed.';
    await db.update(workflowRuns).set({ status: 'failed', error: message, completedAt: new Date() }).where(runScope);
    throw error;
  }

  redirect(`/t/${access.tenant.slug}/projects/${access.project.slug}/automation/${workflow.slug}`);
}
