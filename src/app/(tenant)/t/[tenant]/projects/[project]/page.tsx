import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceHub } from '@/features/projects/workspaces/WorkspaceHub';
import { projectWorkspaces } from '@/features/projects/workspaces/registry';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <WorkspaceHub
        projectDescription={access.project.description}
        projectName={access.project.name}
        projectSlug={access.project.slug}
        tenantSlug={access.tenant.slug}
        workspaces={projectWorkspaces}
      />
    </main>
  );
}
