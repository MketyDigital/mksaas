import Link from 'next/link';

import type { AutomationRunSummary } from './data';
import type { WorkflowNodeSummary } from './workflow-nodes';

export type AutomationBuilderNodeSummary = WorkflowNodeSummary;

export type AutomationBuilderWorkflowSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  triggerType: string;
  version: string;
  updatedAt: Date;
  nodeCount: number;
  nodes: AutomationBuilderNodeSummary[];
};

export type AutomationBuilderReadiness = {
  definitionReady: boolean;
  executionEnabled: boolean;
  webhookActivationEnabled: boolean;
  publishEnabled: boolean;
  safetyNote: string;
};

export function buildAutomationBuilderReadiness(workflow: AutomationBuilderWorkflowSummary): AutomationBuilderReadiness {
  return {
    definitionReady: workflow.nodeCount > 0,
    executionEnabled: true,
    publishEnabled: false,
    webhookActivationEnabled: workflow.triggerType === 'webhook',
    safetyNote:
      'Manual and authenticated webhook execution use readiness-gated workflow runtimes. Publishing, retries, schedules, Agent tools, and arbitrary credentials remain protected.',
  };
}

export function AutomationBuilderShell({
  projectSlug,
  recentRuns,
  tenantSlug,
  workflow,
}: {
  projectSlug: string;
  tenantSlug: string;
  workflow: AutomationBuilderWorkflowSummary;
  recentRuns: AutomationRunSummary[];
}) {
  const readiness = buildAutomationBuilderReadiness(workflow);
  const preparedNodeCount = workflow.nodes.filter((node) => node.isSupported).length;
  const needsReviewNodeCount = workflow.nodes.length - preparedNodeCount;

  return (
    <section aria-labelledby="automation-builder-heading" className="space-y-5 rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workflow builder</p>
          <h2 className="mt-1 text-xl font-semibold" id="automation-builder-heading">
            {workflow.name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {workflow.description || 'Configure this workflow, resolve readiness checks, and use the execution controls below when it is ready.'}
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Execution available
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{workflow.nodeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{workflow.nodeCount === 1 ? 'node' : 'nodes'}</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{workflow.version}</p>
          <p className="mt-1 text-xs text-muted-foreground">Version</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{recentRuns.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Run records</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-2xl font-semibold">{readiness.definitionReady ? 'Ready' : 'Empty'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Definition</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Definition inspection', readiness.definitionReady ? 'Ready' : 'Needs nodes'],
          ['Prepared nodes', String(preparedNodeCount)],
          ['Needs review', String(needsReviewNodeCount)],
          ['Execution runtime', readiness.executionEnabled ? 'Available' : 'Disabled'],
          ['Webhook management', readiness.webhookActivationEnabled ? 'Available' : 'Use webhook trigger'],
          ['Publish controls', readiness.publishEnabled ? 'Enabled' : 'Protected'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-background p-4">
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed bg-background p-4">
        <h3 className="text-sm font-medium">Definition nodes</h3>
        {workflow.nodes.length ? (
          <div className="mt-3 divide-y rounded-lg border text-sm">
            {workflow.nodes.map((node) => (
              <div key={node.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{node.type}</p>
                    <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{node.readinessLabel}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {node.configKeys.length ? `${node.configKeys.length} config keys: ${node.configKeys.join(', ')}` : 'No config keys yet'}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">Configured below</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No nodes yet. Add a trigger and workflow steps below to begin.</p>
        )}
      </div>

      <div className="rounded-xl border border-dashed bg-background p-4">
        <h3 className="text-sm font-medium">Recent run records</h3>
        {recentRuns.length ? (
          <div className="mt-3 divide-y rounded-lg border text-sm">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{run.status}</p>
                  <p className="text-xs text-muted-foreground">{run.triggerType} trigger · auditable record</p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">No retry</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No run records yet. Successful or failed manual and webhook attempts will appear here.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="rounded-md border px-3 py-2 text-sm font-medium" href={`/t/${tenantSlug}/projects/${projectSlug}/automation`}>
          Back to Automation Workspace
        </Link>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">{readiness.safetyNote}</p>
    </section>
  );
}
