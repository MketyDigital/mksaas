import { and, desc, eq } from 'drizzle-orm';

import { AgentPlayground } from '@/features/projects/AgentPlayground';
import { createAgentVersion, publishAgentVersionAction, updateAgent } from '@/features/projects/agent-actions';
import { db } from '@/shared/db';
import { agents, agentVersions, projects, tenantMemberships } from '@/shared/db/schema';
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

  const versions = await db.query.agentVersions.findMany({
    where: and(eq(agentVersions.tenantId, tenant.id), eq(agentVersions.projectId, project.id), eq(agentVersions.agentId, agent.id)),
    orderBy: [desc(agentVersions.version)],
  });
  const publishedVersion = versions.find((version) => version.status === 'published');

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      <div>
        <p className="text-sm text-muted-foreground">Agent Builder · {project.name}</p>
        <h1 className="text-3xl font-semibold">{agent.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure the agent, save a draft, test it, create an immutable version, then publish that version.</p>
      </div>

      <AgentPlayground agentId={agent.id} tenantSlug={tenantSlug} projectSlug={projectSlug} />

      <form action={updateAgent} className="space-y-6">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="projectSlug" value={projectSlug} />
        <input type="hidden" name="agentId" value={agent.id} />

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Identity</h2>
          <label className="grid gap-2 text-sm"><span>Name</span><input name="name" defaultValue={agent.name} required className="rounded-md border bg-background px-3 py-2" /></label>
          <label className="grid gap-2 text-sm"><span>Working status</span><select name="status" defaultValue={agent.status === 'disabled' ? 'disabled' : 'draft'} className="rounded-md border bg-background px-3 py-2"><option value="draft">Draft</option><option value="disabled">Disabled</option></select></label>
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

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="font-medium">Versions & publishing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a snapshot after testing. Only an explicitly published version becomes the production configuration.</p>
        </div>
        <form action={createAgentVersion}>
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <input type="hidden" name="agentId" value={agent.id} />
          <button className="rounded-md border px-4 py-2 text-sm">Create version {versions.length ? versions[0].version + 1 : 1}</button>
        </form>
        <div className="divide-y rounded-lg border">
          {versions.length ? versions.map((version) => (
            <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">Version {version.version}</p>
                <p className="text-muted-foreground">{version.status}{version.publishedAt ? ` · published ${version.publishedAt.toLocaleString()}` : ''}</p>
              </div>
              {version.status !== 'published' ? (
                <form action={publishAgentVersionAction}>
                  <input type="hidden" name="tenantSlug" value={tenantSlug} />
                  <input type="hidden" name="projectSlug" value={projectSlug} />
                  <input type="hidden" name="agentId" value={agent.id} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Publish</button>
                </form>
              ) : <span className="rounded-full border px-3 py-1 text-xs">Live</span>}
            </div>
          )) : <p className="p-4 text-sm text-muted-foreground">No versions yet. Save and test the agent, then create its first version.</p>}
        </div>
        {publishedVersion ? <p className="text-xs text-muted-foreground">Production is currently pinned to version {publishedVersion.version}.</p> : null}
      </section>
    </main>
  );
}
