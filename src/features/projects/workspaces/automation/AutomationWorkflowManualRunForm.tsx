import { startAutomationWorkflowManualRun } from './actions';
import type { AutomationWorkflowPreflightResult } from './workflow-preflight';

export function AutomationWorkflowManualRunForm({
  canManage,
  preflight,
  projectSlug,
  tenantSlug,
  workflowSlug,
}: {
  canManage: boolean;
  preflight: AutomationWorkflowPreflightResult;
  tenantSlug: string;
  projectSlug: string;
  workflowSlug: string;
}) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6">
        <h3 className="text-base font-semibold">Manual run foundation is protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">Only managers can start manual workflow run records.</p>
      </section>
    );
  }

  const ready = preflight.readyForExecutionFoundation && preflight.errorCount === 0 && preflight.warningCount === 0;

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <p className="text-sm font-medium text-muted-foreground">Execution foundation</p>
      <h3 className="mt-1 text-base font-semibold">Manual run foundation</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        This creates an auditable queued → running → completed inspection record. It does not dispatch HTTP, AI, transforms, conditions, webhooks, or retries.
      </p>
      <form action={startAutomationWorkflowManualRun} className="mt-4">
        <input name="tenantSlug" type="hidden" value={tenantSlug} />
        <input name="projectSlug" type="hidden" value={projectSlug} />
        <input name="workflowSlug" type="hidden" value={workflowSlug} />
        <button className="rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready} type="submit">
          Run manual inspection
        </button>
      </form>
      {!ready ? <p className="mt-3 text-sm text-muted-foreground">Resolve every preflight error and warning before starting a manual run record.</p> : null}
    </section>
  );
}
