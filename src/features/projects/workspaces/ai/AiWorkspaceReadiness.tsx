import Link from 'next/link';

import type { AiWorkspaceReadinessItem } from './types';

export function buildAiWorkspaceReadiness({
  agentCount,
  canManage,
  projectSlug,
  tenantSlug,
}: {
  tenantSlug: string;
  projectSlug: string;
  agentCount: number;
  canManage: boolean;
}): AiWorkspaceReadinessItem[] {
  const projectBasePath = `/t/${tenantSlug}/projects/${projectSlug}`;

  return [
    {
      key: 'agents',
      title: 'Agents',
      description: canManage ? 'Create and manage project-scoped agents in Agent Builder.' : 'View the project agents available to this workspace.',
      status: 'available',
      href: `${projectBasePath}/ai`,
      metric: `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`,
    },
    {
      key: 'knowledge',
      title: 'Knowledge',
      description: 'Attach project knowledge, files, and context that agents can use safely.',
      status: 'available',
      href: `${projectBasePath}/knowledge`,
    },
    {
      key: 'tools',
      title: 'Tools',
      description: 'API tools, app actions, and external integrations remain planned until permission and audit rules are designed.',
      status: 'planned',
    },
    {
      key: 'runs',
      title: 'Runs',
      description: 'Run history and execution traces remain planned until run records and retention rules exist.',
      status: 'planned',
    },
    {
      key: 'versions',
      title: 'Versions',
      description: 'Agent configuration versions remain planned until snapshot and rollback rules are defined.',
      status: 'planned',
    },
    {
      key: 'publish',
      title: 'Publish',
      description: 'Publishing remains protected until approvals, environment rules, and deployment boundaries are implemented.',
      status: 'protected',
    },
  ];
}

export function AiWorkspaceReadiness({
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
  const items = buildAiWorkspaceReadiness({ agentCount, canManage, projectSlug, tenantSlug });

  return (
    <section aria-labelledby="ai-readiness-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Readiness map</p>
        <h2 id="ai-readiness-heading" className="mt-1 text-xl font-semibold">
          AI capability readiness
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Agents and Knowledge are usable now. Tools, Runs, Versions, and Publish remain visible so the product direction is clear, but they are not active runtime features yet.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const card = (
            <article className="h-full rounded-xl border bg-background p-4 transition hover:bg-muted/40">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{item.title}</h3>
                <span className="rounded-full border px-2 py-1 text-xs capitalize text-muted-foreground">{item.status}</span>
              </div>
              {item.metric && <p className="mt-2 text-xs font-medium text-muted-foreground">{item.metric}</p>}
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          );

          return item.href ? (
            <Link key={item.key} href={item.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={item.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
