import type { AutomationWorkspaceSnapshot } from './automation/data';

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

export const emptyAutomationWorkspaceSnapshot: AutomationWorkspaceSnapshot = {
  metrics: {
    workflowCount: 0,
    draftWorkflowCount: 0,
    activeWorkflowCount: 0,
    webhookWorkflowCount: 0,
    runCount: 0,
    failedRunCount: 0,
    executionEnabled: false,
  },
  recentRuns: [],
  recentWorkflows: [],
};

export function buildAutomationWorkspaceCapabilities(_: BuildAutomationWorkspaceCapabilitiesOptions): AutomationWorkspaceCapability[] {
  return [
    {
      key: 'workflows',
      title: 'Workflows',
      description: 'View and organize project workflows before the visual builder and execution engine expand.',
      status: 'available',
      statusLabel: 'Read-only',
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
      description: 'Read existing automation attempts, outputs, timings, and audit context without executing workflows.',
      status: 'available',
      statusLabel: 'Read-only',
    },
    {
      key: 'failures',
      title: 'Failures & retries',
      description: 'Surface failed runs and retry readiness while retry execution remains disabled.',
      status: 'planned',
      statusLabel: 'Planned',
    },
  ];
}

export function AutomationWorkspaceOverview({
  projectSlug,
  snapshot = emptyAutomationWorkspaceSnapshot,
  tenantSlug,
}: BuildAutomationWorkspaceCapabilitiesOptions & { snapshot?: AutomationWorkspaceSnapshot }) {
  const capabilities = buildAutomationWorkspaceCapabilities({ projectSlug, tenantSlug });
  const { metrics } = snapshot;

  return (
    <section aria-labelledby="automation-workspace-overview-heading" className="space-y-5 rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Automation Workspace foundation</p>
          <h2 className="mt-1 text-xl font-semibold" id="automation-workspace-overview-heading">
            Design repeatable workflows safely
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This overview exposes the Mkety automation product surface and now reads the existing workflow data model, while
            keeping real triggers, webhooks, execution, retries, and workflow-engine expansion behind planned or protected states.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          {metrics.executionEnabled ? 'Execution enabled' : 'Execution disabled'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.workflowCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Workflows</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.draftWorkflowCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Draft</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.activeWorkflowCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active records</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.webhookWorkflowCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Webhook triggers</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.runCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Run records</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{metrics.failedRunCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Failed runs</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

      <div className="rounded-xl border border-dashed bg-background p-4">
        <h3 className="text-sm font-medium">Recent workflow records</h3>
        {snapshot.recentWorkflows.length ? (
          <div className="mt-3 divide-y rounded-lg border text-sm">
            {snapshot.recentWorkflows.map((workflow) => (
              <div key={workflow.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{workflow.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {workflow.triggerType} trigger · version {workflow.version}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{workflow.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No workflow records yet. The data model is ready for read-only display before builder and execution features are enabled.</p>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Automation execution remains intentionally inactive in this branch. Existing workflow and run records can be displayed,
        but no trigger, webhook, retry, or action execution is exposed here.
      </p>
    </section>
  );
}
