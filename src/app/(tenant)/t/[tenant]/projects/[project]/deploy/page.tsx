import { DeployFoundationPanel } from '@/features/deploy/components/DeployFoundationPanel';
import { getDeployFoundationState } from '@/features/deploy/server/queries';
import { requireProjectAccess } from '@/features/projects/server/access';
import { DeployWorkspaceOverview } from '@/features/projects/workspaces/DeployWorkspaceOverview';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function DeployWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  const deployState = await getDeployFoundationState(access.tenant.id, access.project.id);

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('deploy')}
    >
      <div className="space-y-6">
        <DeployWorkspaceOverview projectSlug={access.project.slug} tenantSlug={access.tenant.slug} />
        <DeployFoundationPanel
          canManage={access.canManage}
          projectSlug={access.project.slug}
          state={deployState}
          tenantSlug={access.tenant.slug}
        />
      </div>
    </WorkspaceShell>
  );
}
