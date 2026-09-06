import type { AutomationWorkflowPreflightResult } from './workflow-preflight';

export function AutomationWorkflowPreflightPanel({ preflight }: { preflight: AutomationWorkflowPreflightResult }) {
  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workflow preflight</p>
          <h3 className="mt-1 text-base font-semibold">Validate the draft before runtime exists</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Preflight checks only the saved workflow definition. It does not execute agents, make HTTP requests, activate triggers, resolve credentials, or call external providers.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          {preflight.readyForExecutionFoundation ? 'Ready for execution foundation' : 'Needs preflight attention'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-4"><p className="text-2xl font-semibold">{preflight.errorCount}</p><p className="mt-1 text-xs text-muted-foreground">Errors</p></div>
        <div className="rounded-xl border bg-background p-4"><p className="text-2xl font-semibold">{preflight.warningCount}</p><p className="mt-1 text-xs text-muted-foreground">Warnings</p></div>
        <div className="rounded-xl border bg-background p-4"><p className="text-2xl font-semibold">{preflight.readyCount}</p><p className="mt-1 text-xs text-muted-foreground">Ready checks</p></div>
      </div>

      <div className="mt-5 divide-y rounded-xl border bg-background text-sm">
        {preflight.checks.map((check, index) => (
          <div className="flex flex-wrap items-start justify-between gap-3 p-3" key={`${check.code}-${check.nodeId || 'workflow'}-${index}`}>
            <div>
              <p className="font-medium">{check.message}</p>
              {check.nodeId ? <p className="mt-1 text-xs text-muted-foreground">Node: {check.nodeId}</p> : null}
            </div>
            <span className="rounded-full border px-2 py-1 text-xs capitalize text-muted-foreground">{check.severity}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">This status is informational only. It does not change workflow status, publish a workflow, or enable execution.</p>
    </section>
  );
}
