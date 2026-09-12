import { and, desc, eq } from 'drizzle-orm';

import { createAgent } from '@/features/projects/actions';
import { requireProjectAccess } from '@/features/projects/server/access';
import { AiAgentSummaryGrid } from '@/features/projects/workspaces/ai/AiAgentSummaryGrid';
import { AiWorkspaceReadiness } from '@/features/projects/workspaces/ai/AiWorkspaceReadiness';
import { AiWorkspaceStatusPanel } from '@/features/projects/workspaces/ai/AiWorkspaceStatusPanel';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { db } from '@/shared/db';
import { agents } from '@/shared/db/schema';

export const dynamic = 'force-dynamic';

export default async function AiWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  const projectAgents = await db.query.agents.findMany({
    where: and(eq(agents.tenantId, access.tenant.id), eq(agents.projectId, access.project.id)),
    orderBy: [desc(agents.createdAt)],
  });

  const knowledgeStatus = access.canManage ? 'Ready for project knowledge' : 'Project knowledge available';

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('ai')}
    >
      <AiWorkspaceStatusPanel agentCount={projectAgents.length} canManage={access.canManage} knowledgeStatus={knowledgeStatus} />

      <AiWorkspaceReadiness agentCount={projectAgents.length} canManage={access.canManage} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} />

      {access.canManage && (
        <section className="rounded-2xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Agent creation</p>
          <h2 className="mt-1 text-xl font-semibold">Create AI agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create the agent here, then open it in the full Agent Builder.</p>
          <form action={createAgent} className="mt-4 grid gap-3">
            <input type="hidden" name="tenantSlug" value={access.tenant.slug} />
            <input type="hidden" name="projectSlug" value={access.project.slug} />
            <input name="name" required placeholder="Agent name" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="slug" placeholder="Slug (optional)" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <textarea name="instructions" placeholder="System instructions" rows={5} className="rounded-md border bg-background px-3 py-2 text-sm" />
            <button className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create agent</button>
          </form>
        </section>
      )}

      <AiAgentSummaryGrid agents={projectAgents} canManage={access.canManage} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} />
    </WorkspaceShell>
  );
}
