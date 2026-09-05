import Link from 'next/link';

import type { AiAgentSummary } from './types';

export function AiAgentSummaryGrid({
  agents,
  canManage,
  projectSlug,
  tenantSlug,
}: {
  tenantSlug: string;
  projectSlug: string;
  agents: AiAgentSummary[];
  canManage: boolean;
}) {
  return (
    <section aria-labelledby="ai-agent-summary-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Agent inventory</p>
          <h2 id="ai-agent-summary-heading" className="mt-1 text-xl font-semibold">
            Project agents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Agents belong to this project and remain scoped to this tenant.</p>
        </div>
        <Link href={`/t/${tenantSlug}/projects/${projectSlug}/knowledge`} className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70">
          Manage knowledge
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/t/${tenantSlug}/projects/${projectSlug}/agents/${agent.slug}`} className="rounded-xl border bg-card p-5 transition hover:bg-muted/40">
            <div className="flex items-center justify-between gap-4">
              <div className="font-medium">{agent.name}</div>
              <span className="rounded-full border px-2 py-1 text-xs">{agent.status}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {agent.provider ?? 'provider not set'}
              {agent.model ? ` · ${agent.model}` : ''}
            </p>
            {agent.instructions && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{agent.instructions}</p>}
            {canManage && <p className="mt-4 text-xs font-medium">Open Agent Builder →</p>}
          </Link>
        ))}
        {agents.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground md:col-span-2">
            <p className="font-medium text-foreground">No agents yet.</p>
            <p className="mt-2">Create your first AI agent above, then connect knowledge and test future tools in controlled batches.</p>
          </div>
        )}
      </div>
    </section>
  );
}
