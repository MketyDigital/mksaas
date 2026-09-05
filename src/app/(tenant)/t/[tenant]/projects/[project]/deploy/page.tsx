import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
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
      <WorkspaceEmptyState
        actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}`, label: 'Back to project workspaces' }]}
        description="Deploy will manage application records, environments, previews, production states, deployment history, and domains before any real Cloudflare or OCI automation is enabled."
        title="Deploy foundation is planned"
      />
    </WorkspaceShell>
  );
}
