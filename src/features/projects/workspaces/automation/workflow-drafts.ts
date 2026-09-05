import type { WorkflowDefinition } from '@/shared/db/schema';

export function slugifyWorkflowName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

export function buildDefaultWorkflowDefinition(): WorkflowDefinition {
  return { nodes: [] };
}

export function buildWorkflowDraftInput({
  description,
  name,
  projectId,
  tenantId,
}: {
  tenantId: string;
  projectId: string;
  name: string;
  description?: string | null;
}) {
  const normalizedName = name.trim();
  const slug = slugifyWorkflowName(normalizedName);

  if (!normalizedName || !slug) {
    throw new Error('Workflow name is required.');
  }

  return {
    definition: buildDefaultWorkflowDefinition(),
    description: description?.trim() || null,
    name: normalizedName,
    projectId,
    slug,
    status: 'draft',
    tenantId,
    triggerType: 'manual',
    version: '1',
  };
}
