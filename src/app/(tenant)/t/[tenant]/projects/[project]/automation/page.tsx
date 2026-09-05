import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';

export const dynamic = 'force-dynamic';

export default async function AutomationWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('automation')}
    >
      <WorkspaceEmptyState
        actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}/ai`, label: 'Use AI Workspace for now' }]}
        description="Workflow builder, triggers, actions, webhooks, run history, retries, and failure handling will be implemented after the core workspace shell is stable."
        title="Automation foundation is planned"
      />
    </WorkspaceShell>
  );
}
