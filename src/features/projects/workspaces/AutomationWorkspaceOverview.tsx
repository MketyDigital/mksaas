import Link from 'next/link';

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
    executionEnabled: true,
  },
  recentRuns: [],
  recentWorkflows: [],
};

export function buildAutomationWorkspaceCapabilities(_: BuildAutomationWorkspaceCapabilitiesOptions): AutomationWorkspaceCapability[] {
  return [
    {
      key: 'workflows',
      title: 'Workflows',
      description: 'Create and configure project workflows in the builder with preflight and runtime readiness checks.',
      status: 'available',
      statusLabel: 'Available',
    },
    {
      key: 'triggers',
      title: 'Triggers',
      description: 'Run workflows manually or through authenticated webhooks. Scheduled and app-event triggers remain planned.',
      status: 'available',
      statusLabel: 'Manual + webhook',
    },
    {
      key: 'actions',
      title: 'Actions',
      description: 'Execute transforms, conditions, guarded HTTPS actions, and published Agent versions through one workflow kernel.',
      status: 'available',
      statusLabel: 'Runtime ready',
    },
    {
      key: 'webhooks',
      title: 'Webhooks',
      description: 'Provision signed inbound webhook endpoints from each webhook-triggered workflow builder.',
      status: 'available',
      statusLabel: 'Builder-managed',
    },
    {
      key: 'run-history',
      title: 'Run history',
      description: 'Review auditable manual and webhook workflow run outcomes and timings.',
      status: 'available',
      statusLabel: 'Available',
    },
    {
      key: 'failures',
      title: 'Failures & retries',
      description: 'Failed runs are recorded now; bounded retry execution remains a later phase.',
      status: 'planned',
      statusLabel: 'Retries planned',
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
          <p className="text-sm font-medium text-muted-foreground">Automation Workspace</p>
          <h2 className="mt-1 text-xl font-semibold" id="automation-workspace-overview-heading">
            Design repeatable workflows safely
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Build workflows with readiness checks, run them manually, or receive authenticated webhook events through the same auditable execution lifecycle.
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
                <div className="flex items-center gap-2">
                  <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{workflow.status}</span>
                  <Link
                    className="rounded-md border px-2 py-1 text-xs font-medium"
                    href={`/t/${tenantSlug}/projects/${projectSlug}/automation/${workflow.slug}`}
                  >
                    Open builder
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No workflow records yet. Create a workflow to configure its trigger, nodes, readiness, and execution.</p>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Manual and authenticated webhook execution are available through workflow builders. Schedules, retries, Agent tools, and arbitrary credentials remain disabled until their dedicated safety phases.
      </p>
    </section>
  );
}