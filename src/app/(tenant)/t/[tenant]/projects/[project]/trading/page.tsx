import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
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
      <WorkspaceEmptyState
        actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}`, label: 'Back to project workspaces' }]}
        description="Trading remains visible for custom enterprise systems only. This route is a request/intake shell and does not create trading accounts, signals, broker links, copy-trading, or execution records."
        title="Trading is custom enterprise only"
      />
    </WorkspaceShell>
  );
}
