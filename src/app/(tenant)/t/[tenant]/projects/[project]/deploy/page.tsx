import { requireProjectAccess } from '@/features/projects/server/access';
import { DeployWorkspaceOverview } from '@/features/projects/workspaces/DeployWorkspaceOverview';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';

export const dynamic = 'force-dynamic';

export default async function DeployWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
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
      workspace={getProjectWorkspaceByKey('deploy')}
    >
      <DeployWorkspaceOverview projectSlug={access.project.slug} tenantSlug={access.tenant.slug} />
    </WorkspaceShell>
  );
}
