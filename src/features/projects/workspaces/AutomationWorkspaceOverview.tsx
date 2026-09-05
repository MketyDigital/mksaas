type AutomationCapabilityStatus = 'available' | 'planned' | 'protected';

type AutomationWorkspaceCapability = {
  key: 'workflows' | 'triggers' | 'actions' | 'webhooks' | 'run-history' | 'failures';
  title: string;
  description: string;
  statusLabel: string;
  status: AutomationCapabilityStatus;
  href?: string;
};

type BuildAutomationWorkspaceCapabilitiesOptions = {
  projectSlug: string;
  tenantSlug: string;
};

export function buildAutomationWorkspaceCapabilities(_: BuildAutomationWorkspaceCapabilitiesOptions): AutomationWorkspaceCapability[] {
  return [
    {
      key: 'workflows',
      title: 'Workflows',
      description: 'View and organize project workflows before the visual builder and execution engine expand.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'triggers',
      title: 'Triggers',
      description: 'Prepare manual, scheduled, webhook, and app-event entry points for future automation runs.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'actions',
      title: 'Actions',
      description: 'Map the steps automations can perform across AI, integrations, APIs, notifications, and apps.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'webhooks',
      title: 'Webhooks',
      description: 'Reserve the inbound and outbound webhook surface without exposing unaudited endpoints yet.',
      status: 'protected',
      statusLabel: 'Protected',
    },
    {
      key: 'run-history',
      title: 'Run history',
      description: 'Track automation attempts, outputs, timings, and audit context once execution records are introduced.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'failures',
      title: 'Failures & retries',
      description: 'Surface failed runs, retry decisions, and operator notes after safe execution controls exist.',
      status: 'planned',
      statusLabel: 'Planned',
    },
  ];
}

export function AutomationWorkspaceOverview({ projectSlug, tenantSlug }: BuildAutomationWorkspaceCapabilitiesOptions) {
  const capabilities = buildAutomationWorkspaceCapabilities({ projectSlug, tenantSlug });

  return (
    <section aria-labelledby="automation-workspace-overview-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Automation Workspace foundation</p>
          <h2 className="mt-1 text-xl font-semibold" id="automation-workspace-overview-heading">
            Design repeatable workflows safely
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This overview exposes the Mkety automation product surface while keeping real triggers, webhooks, execution,
            retries, and workflow-engine expansion behind planned or protected states.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Blueprint only</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {capabilities.map((capability) => (
          <article key={capability.key} className="h-full rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{capability.title}</h3>
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{capability.statusLabel}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{capability.description}</p>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Automation execution remains intentionally inactive in this branch. The next backend slice should add tenant-scoped
        workflow records, trigger rules, run logs, retries, and audit boundaries before any live automation can run.
      </p>
    </section>
  );
}
