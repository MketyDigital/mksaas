import { and, eq } from 'drizzle-orm';

import { AgentPlayground } from '@/features/projects/AgentPlayground';
import { updateAgent } from '@/features/projects/agent-actions';
import { db } from '@/shared/db';
import { agents, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function AgentBuilderPage({ params }: { params: Promise<{ tenant: string; project: string; agent: string }> }) {
  const { tenant: tenantSlug, project: projectSlug, agent: agentSlug } = await params;
  const session = await auth();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!session?.user?.id || !tenant) return <div className="p-8">Workspace not found.</div>;

  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return <div className="p-8">Forbidden.</div>;

  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  const agent = project ? await db.query.agents.findFirst({ where: and(eq(agents.tenantId, tenant.id), eq(agents.projectId, project.id), eq(agents.slug, agentSlug)) }) : null;
  if (!project || !agent) return <div className="p-8">Agent not found.</div>;

  const canManage = membership.role === 'admin' || membership.role === 'manager';
  if (!canManage) return <div className="p-8">You do not have permission to edit this agent.</div>;

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Agent Builder · {project.name}</p>
        <h1 className="text-3xl font-semibold">{agent.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure the agent, save a draft, then test it in the runtime playground.</p>
      </div>

      <AgentPlayground agentId={agent.id} tenantSlug={tenantSlug} projectSlug={projectSlug} />

      <form action={updateAgent} className="space-y-6">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="projectSlug" value={projectSlug} />
        <input type="hidden" name="agentId" value={agent.id} />

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Identity</h2>
          <label className="grid gap-2 text-sm"><span>Name</span><input name="name" defaultValue={agent.name} required className="rounded-md border bg-background px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>Status</span><select name="status" defaultValue={agent.status} className="rounded-md border bg-background px-3 py-2"><option value="draft">Draft</option><option value="published">Published</option><option value="disabled">Disabled</option></select></label>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Model</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm"><span>Provider</span><select name="provider" defaultValue={agent.provider} className="rounded-md border bg-background px-3 py-2"><option value="platform">Mkety Platform</option><option value="openai">OpenAI</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option><option value="custom">Custom</option></select></label>
            <label className="grid gap-2 text-sm"><span>Model</span><input name="model" defaultValue={agent.model ?? ''} placeholder="e.g. gpt-4o-mini" className="rounded-md border bg-background px-3 py-2" /></label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Instructions</h2>
          <textarea name="instructions" defaultValue={agent.instructions ?? ''} rows={10} placeholder="Tell the agent who it is, what it should do, constraints, tone, and goals." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Advanced configuration</h2>
          <p className="text-sm text-muted-foreground">JSON is provider-neutral so runtime settings can evolve without coupling the agent definition to a provider.</p>
          <textarea name="config" defaultValue={agent.config ?? ''} rows={8} placeholder={'{\n  "temperature": 0.7,\n  "maxOutputTokens": 2048\n}'} className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
        </section>

        <div className="flex gap-3">
          <button className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Save agent</button>
          <a href={`/t/${tenantSlug}/projects/${projectSlug}`} className="rounded-md border px-5 py-2 text-sm">Back to project</a>
        </div>
      </form>
    </main>
  );
}
