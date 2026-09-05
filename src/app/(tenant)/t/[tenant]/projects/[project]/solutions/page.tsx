import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';

export const dynamic = 'force-dynamic';

export default async function SolutionHubWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
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
      workspace={getProjectWorkspaceByKey('solutions')}
    >
      <WorkspaceEmptyState
        actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}/automation`, label: 'Preview Automation Workspace' }]}
        description="SolutionHub will expose ready-made solutions, templates, blueprints, and enterprise implementation paths without making every solution a self-service product too early."
        title="SolutionHub catalog is planned"
      />
    </WorkspaceShell>
  );
}
