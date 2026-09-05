export type AgentBuilderStatus = {
  name: string;
  status: string;
  provider: string;
  model: string | null;
  hasInstructions: boolean;
  hasConfig: boolean;
};

function formatStatus(status: string) {
  return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'Unknown';
}

export function AgentBuilderStatusPanel({
  agent,
  publishedVersionNumber,
  versionCount,
}: {
  agent: AgentBuilderStatus;
  versionCount: number;
  publishedVersionNumber: number | null;
}) {
  const readinessItems = [
    { label: 'Working status', value: formatStatus(agent.status) },
    { label: 'Provider', value: agent.provider },
    { label: 'Model', value: agent.model || 'Model not selected' },
    { label: 'Instructions', value: agent.hasInstructions ? 'Instructions ready' : 'Instructions missing' },
    { label: 'Advanced configuration', value: agent.hasConfig ? 'Advanced config present' : 'No advanced config' },
    { label: 'Versions', value: `${versionCount} ${versionCount === 1 ? 'version' : 'versions'}` },
    { label: 'Published state', value: publishedVersionNumber ? `Production pinned to v${publishedVersionNumber}` : 'No published version' },
  ];

  return (
    <section aria-labelledby="agent-builder-status-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Agent Builder status</p>
          <h2 id="agent-builder-status-heading" className="mt-1 text-2xl font-semibold">
            {agent.name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review the agent configuration before saving, snapshotting, or publishing through the existing controlled version flow.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Display-only summary</span>
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readinessItems.map((item) => (
          <div key={item.label} className="rounded-xl border bg-background p-4">
            <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
            <dd className="mt-2 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
