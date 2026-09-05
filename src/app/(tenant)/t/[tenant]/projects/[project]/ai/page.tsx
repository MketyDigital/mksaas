import Link from 'next/link';
import { desc, and, eq } from 'drizzle-orm';

import { createAgent } from '@/features/projects/actions';
import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
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

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('ai')}
    >
      {access.canManage && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-medium">Create AI agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create the agent here, then open it in the full Agent Builder.</p>
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

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Agents</h2>
            <p className="mt-1 text-sm text-muted-foreground">Agents belong to this project and remain scoped to this tenant.</p>
          </div>
          <Link href={`/t/${access.tenant.slug}/projects/${access.project.slug}/knowledge`} className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70">
            Manage knowledge
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {projectAgents.map((agent) => (
            <Link key={agent.id} href={`/t/${access.tenant.slug}/projects/${access.project.slug}/agents/${agent.slug}`} className="rounded-xl border bg-card p-5 transition hover:bg-muted/40">
              <div className="flex items-center justify-between gap-4">
                <div className="font-medium">{agent.name}</div>
                <span className="rounded-full border px-2 py-1 text-xs">{agent.status}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {agent.provider}
                {agent.model ? ` · ${agent.model}` : ''}
              </p>
              {agent.instructions && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{agent.instructions}</p>}
              {access.canManage && <p className="mt-4 text-xs font-medium">Open Agent Builder →</p>}
            </Link>
          ))}
          {projectAgents.length === 0 && <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground md:col-span-2">No agents yet.</div>}
        </div>
      </section>
    </WorkspaceShell>
  );
}
