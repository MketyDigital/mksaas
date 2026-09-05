import { requireProjectAccess } from '@/features/projects/server/access';
import { TradingWorkspaceOverview } from '@/features/projects/workspaces/TradingWorkspaceOverview';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';

export const dynamic = 'force-dynamic';

export default async function TradingWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
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
      workspace={getProjectWorkspaceByKey('trading')}
    >
      <TradingWorkspaceOverview />
    </WorkspaceShell>
  );
}
