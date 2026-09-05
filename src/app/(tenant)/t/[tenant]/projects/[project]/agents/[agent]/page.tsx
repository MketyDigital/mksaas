import { and, desc, eq } from 'drizzle-orm';
import Link from 'next/link';

import { AgentPlayground } from '@/features/projects/AgentPlayground';
import { createAgentVersion, publishAgentVersionAction, updateAgent } from '@/features/projects/agent-actions';
import { requireProjectAccess } from '@/features/projects/server/access';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { db } from '@/shared/db';
import { agents, agentVersions } from '@/shared/db/schema';

export const dynamic = 'force-dynamic';

export default async function AgentBuilderPage({ params }: { params: Promise<{ tenant: string; project: string; agent: string }> }) {
  const { agent: agentSlug, project: projectSlug, tenant: tenantSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });

  if (access.status !== 'ok') {
    return <div className="p-8">{access.reason}</div>;
  }

  if (!access.canManage) {
    return <div className="p-8">You do not have permission to edit this agent.</div>;
  }

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.tenantId, access.tenant.id), eq(agents.projectId, access.project.id), eq(agents.slug, agentSlug)),
  });

  if (!agent) {
    return <div className="p-8">Agent not found.</div>;
  }

  const versions = await db.query.agentVersions.findMany({
    where: and(eq(agentVersions.tenantId, access.tenant.id), eq(agentVersions.projectId, access.project.id), eq(agentVersions.agentId, agent.id)),
    orderBy: [desc(agentVersions.version)],
  });
  const publishedVersion = versions.find((version) => version.status === 'published');

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('ai')}
    >
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Agent Builder</p>
            <h2 className="mt-1 text-2xl font-semibold">{agent.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Configure the agent, test it in this project, create immutable versions, and publish only after explicit approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/t/${access.tenant.slug}/projects/${access.project.slug}/ai`} className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70">
              Back to AI Workspace
            </Link>
            <Link
              href={`/t/${access.tenant.slug}/projects/${access.project.slug}/knowledge`}
              className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70"
            >
              Manage knowledge
            </Link>
          </div>
        </div>
      </section>

      <AgentPlayground agentId={agent.id} tenantSlug={access.tenant.slug} projectSlug={access.project.slug} />

      <form action={updateAgent} className="space-y-6">
        <input type="hidden" name="tenantSlug" value={access.tenant.slug} />
        <input type="hidden" name="projectSlug" value={access.project.slug} />
        <input type="hidden" name="agentId" value={agent.id} />

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Identity</h2>
          <label className="grid gap-2 text-sm">
            <span>Name</span>
            <input name="name" defaultValue={agent.name} required className="rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Working status</span>
            <select name="status" defaultValue={agent.status === 'disabled' ? 'disabled' : 'draft'} className="rounded-md border bg-background px-3 py-2">
              <option value="draft">Draft</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Model</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span>Provider</span>
              <select name="provider" defaultValue={agent.provider} className="rounded-md border bg-background px-3 py-2">
                <option value="platform">Mkety Platform</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span>Model</span>
              <input name="model" defaultValue={agent.model ?? ''} placeholder="e.g. gpt-4o-mini" className="rounded-md border bg-background px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Instructions</h2>
          <textarea
            name="instructions"
            defaultValue={agent.instructions ?? ''}
            rows={10}
            placeholder="Tell the agent who it is, what it should do, constraints, tone, and goals."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium">Advanced configuration</h2>
          <p className="text-sm text-muted-foreground">JSON is provider-neutral so runtime settings can evolve without coupling the agent definition to a provider.</p>
          <textarea
            name="config"
            defaultValue={agent.config ?? ''}
            rows={8}
            placeholder={'{\n  "temperature": 0.7,\n  "maxOutputTokens": 2048\n}'}
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Save agent</button>
          <Link href={`/t/${access.tenant.slug}/projects/${access.project.slug}/ai`} className="rounded-md border px-5 py-2 text-sm transition hover:bg-muted/70">
            Back to AI Workspace
          </Link>
        </div>
      </form>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="font-medium">Versions & publishing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a snapshot after testing. Only an explicitly published version becomes the production configuration.</p>
        </div>
        <form action={createAgentVersion}>
          <input type="hidden" name="tenantSlug" value={access.tenant.slug} />
          <input type="hidden" name="projectSlug" value={access.project.slug} />
          <input type="hidden" name="agentId" value={agent.id} />
          <button className="rounded-md border px-4 py-2 text-sm">Create version {versions.length ? versions[0].version + 1 : 1}</button>
        </form>
        <div className="divide-y rounded-lg border">
          {versions.length ? (
            versions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">Version {version.version}</p>
                  <p className="text-muted-foreground">
                    {version.status}
                    {version.publishedAt ? ` · published ${version.publishedAt.toLocaleString()}` : ''}
                  </p>
                </div>
                {version.status !== 'published' ? (
                  <form action={publishAgentVersionAction}>
                    <input type="hidden" name="tenantSlug" value={access.tenant.slug} />
                    <input type="hidden" name="projectSlug" value={access.project.slug} />
                    <input type="hidden" name="agentId" value={agent.id} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Publish</button>
                  </form>
                ) : (
                  <span className="rounded-full border px-3 py-1 text-xs">Live</span>
                )}
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No versions yet. Save and test the agent, then create its first version.</p>
          )}
        </div>
        {publishedVersion ? <p className="text-xs text-muted-foreground">Production is currently pinned to version {publishedVersion.version}.</p> : null}
      </section>
    </WorkspaceShell>
  );
}
