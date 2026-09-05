import Link from 'next/link';

export type AiWorkspaceCapability = {
  key: 'agents' | 'knowledge' | 'tools' | 'runs' | 'versions' | 'publish';
  title: string;
  description: string;
  statusLabel: string;
  href?: string;
  metric?: string;
};

export function buildAiWorkspaceCapabilities({
  agentCount,
  canManage,
  projectSlug,
  tenantSlug,
}: {
  tenantSlug: string;
  projectSlug: string;
  agentCount: number;
  canManage: boolean;
}): AiWorkspaceCapability[] {
  const projectBasePath = `/t/${tenantSlug}/projects/${projectSlug}`;

  return [
    {
      key: 'agents',
      title: 'Agents',
      description: canManage
        ? 'Create, configure, and open project agents in the Agent Builder.'
        : 'View the agents available inside this project.',
      statusLabel: 'Available',
      href: `${projectBasePath}/ai`,
      metric: `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`,
    },
    {
      key: 'knowledge',
      title: 'Knowledge',
      description: 'Manage the files, notes, and structured knowledge this project can attach to agents.',
      statusLabel: 'Available',
      href: `${projectBasePath}/knowledge`,
    },
    {
      key: 'tools',
      title: 'Tools',
      description: 'Prepare API tools, app actions, and integrations that agents will be allowed to call.',
      statusLabel: 'Planned',
    },
    {
      key: 'runs',
      title: 'Runs',
      description: 'Review agent test runs, production runs, execution traces, and failure context.',
      statusLabel: 'Planned',
    },
    {
      key: 'versions',
      title: 'Versions',
      description: 'Track agent configuration versions before publishing controlled updates.',
      statusLabel: 'Planned',
    },
    {
      key: 'publish',
      title: 'Publish',
      description: 'Promote tested agents into safe project or product surfaces with explicit approval.',
      statusLabel: 'Protected',
    },
  ];
}

export function AiWorkspaceOverview({
  agentCount,
  canManage,
  projectSlug,
  tenantSlug,
}: {
  tenantSlug: string;
  projectSlug: string;
  agentCount: number;
  canManage: boolean;
}) {
  const capabilities = buildAiWorkspaceCapabilities({ agentCount, canManage, projectSlug, tenantSlug });

  return (
    <section aria-labelledby="ai-workspace-overview-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">AI Workspace foundation</p>
          <h2 id="ai-workspace-overview-heading" className="mt-1 text-xl font-semibold">
            Build, connect, test, and publish agents
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This overview keeps the AI product surface organized while deeper agent tools, run history, versioning, and publishing are added in controlled batches.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">{agentCount} total agents</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {capabilities.map((capability) => {
          const card = (
            <article className="h-full rounded-xl border bg-background p-4 transition hover:bg-muted/40">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{capability.title}</h3>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{capability.statusLabel}</span>
              </div>
              {capability.metric && <p className="mt-2 text-xs font-medium text-muted-foreground">{capability.metric}</p>}
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{capability.description}</p>
            </article>
          );

          return capability.href ? (
            <Link key={capability.key} href={capability.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={capability.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
