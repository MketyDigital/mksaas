import { requireProjectAccess } from '@/features/projects/server/access';
import { AutomationWorkflowDraftForm } from '@/features/projects/workspaces/automation/AutomationWorkflowDraftForm';
import { getAutomationWorkspaceSnapshot } from '@/features/projects/workspaces/automation/data';
import { AutomationWorkspaceOverview } from '@/features/projects/workspaces/AutomationWorkspaceOverview';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function AutomationWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  const snapshot = await getAutomationWorkspaceSnapshot({ projectId: access.project.id, tenantId: access.tenant.id });

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('automation')}
    >
      <AutomationWorkspaceOverview projectSlug={access.project.slug} snapshot={snapshot} tenantSlug={access.tenant.slug} />
      <AutomationWorkflowDraftForm canManage={access.canManage} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} />
      <WorkspaceEmptyState
        actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}/ai`, label: 'Use AI Workspace for now' }]}
        description="Workflow builder, triggers, actions, webhooks, live execution, retries, and failure handling remain inactive until execution safety, audit, and permission rules are complete."
        title="Automation execution is not active yet"
      />
    </WorkspaceShell>
  );
}
