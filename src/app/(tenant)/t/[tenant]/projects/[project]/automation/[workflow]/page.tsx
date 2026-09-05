import { getAutomationBuilderSnapshot } from '@/features/projects/workspaces/automation/data';
import { AutomationBuilderShell } from '@/features/projects/workspaces/automation/AutomationBuilderShell';
import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function AutomationBuilderPage({
  params,
}: {
  params: Promise<{ tenant: string; project: string; workflow: string }>;
}) {
  const { project: projectSlug, tenant: tenantSlug, workflow: workflowSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  const snapshot = await getAutomationBuilderSnapshot({
    projectId: access.project.id,
    tenantId: access.tenant.id,
    workflowSlug,
  });

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('automation')}
    >
      {snapshot ? (
        <AutomationBuilderShell
          projectSlug={access.project.slug}
          recentRuns={snapshot.recentRuns}
          tenantSlug={access.tenant.slug}
          workflow={snapshot.workflow}
        />
      ) : (
        <WorkspaceEmptyState
          actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}/automation`, label: 'Back to Automation Workspace' }]}
          description="This workflow record could not be found inside the current tenant and project."
          title="Workflow not found"
        />
      )}
    </WorkspaceShell>
  );
}
