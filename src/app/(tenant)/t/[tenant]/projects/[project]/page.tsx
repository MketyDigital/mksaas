import { and, desc, eq } from 'drizzle-orm';

import { createAgent } from '@/features/projects/actions';
import { db } from '@/shared/db';
import { agents, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const session = await auth();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!session?.user?.id || !tenant) return <div className="p-8">Workspace not found.</div>;

  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return <div className="p-8">Forbidden.</div>;

  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) return <div className="p-8">Project not found.</div>;

  const projectAgents = await db.query.agents.findMany({ where: and(eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id)), orderBy: [desc(agents.createdAt)] });
  const canManage = membership.role === 'admin' || membership.role === 'manager';

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Project</p>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
      </div>

      {canManage && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-medium">Create AI agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">This is the first persistent layer of the Mkety Agent Builder.</p>
          <form action={createAgent} className="mt-4 grid gap-3">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="projectSlug" value={projectSlug} />
            <input name="name" required placeholder="Agent name" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="slug" placeholder="Slug (optional)" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <textarea name="instructions" placeholder="System instructions" rows={5} className="rounded-md border bg-background px-3 py-2 text-sm" />
            <button className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create agent</button>
          </form>
        </section>
      )}

      <section>
        <h2 className="font-medium">Agents</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {projectAgents.map((agent) => (
            <div key={agent.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="font-medium">{agent.name}</div>
                <span className="rounded-full border px-2 py-1 text-xs">{agent.status}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{agent.provider}{agent.model ? ` · ${agent.model}` : ''}</p>
              {agent.instructions && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{agent.instructions}</p>}
            </div>
          ))}
          {projectAgents.length === 0 && <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground md:col-span-2">No agents yet.</div>}
        </div>
      </section>
    </main>
  );
}
