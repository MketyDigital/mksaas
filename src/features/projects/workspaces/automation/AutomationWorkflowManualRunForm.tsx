import { startAutomationWorkflowManualRun } from './actions';
import type { AutomationWorkflowPreflightResult } from './workflow-preflight';
import type { AutomationWorkflowRuntimeReadiness } from './workflow-runtime-readiness';

export function AutomationWorkflowManualRunForm({ canManage, preflight, projectSlug, runtimeReadiness, tenantSlug, workflowSlug }: { canManage: boolean; preflight: AutomationWorkflowPreflightResult; runtimeReadiness: AutomationWorkflowRuntimeReadiness; tenantSlug: string; projectSlug: string; workflowSlug: string }) {
  if (!canManage) return <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6"><h3 className="text-base font-semibold">Manual execution is protected</h3><p className="mt-2 text-sm text-muted-foreground">Only managers can start manual workflow runs.</p></section>;
  const ready = preflight.readyForExecutionFoundation && preflight.errorCount === 0 && preflight.warningCount === 0 && runtimeReadiness.ready;
  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <p className="text-sm font-medium text-muted-foreground">Execution foundation</p>
      <h3 className="mt-1 text-base font-semibold">Manual workflow execution</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Runs trigger, transform, condition, and guarded HTTPS actions inside the auditable workflow lifecycle. Agent actions, webhooks, retries, and credentials are not yet enabled.</p>
      <form action={startAutomationWorkflowManualRun} className="mt-4"><input name="tenantSlug" type="hidden" value={tenantSlug} /><input name="projectSlug" type="hidden" value={projectSlug} /><input name="workflowSlug" type="hidden" value={workflowSlug} /><button className="rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready} type="submit">Run workflow</button></form>
      {!preflight.readyForExecutionFoundation || preflight.errorCount > 0 || preflight.warningCount > 0 ? <p className="mt-3 text-sm text-muted-foreground">Resolve every preflight error and warning before starting a manual run.</p> : null}
      {!runtimeReadiness.ready ? <div className="mt-3 text-sm text-muted-foreground"><p>Resolve runtime readiness blockers before starting a manual run.</p><ul className="mt-1 list-disc pl-5">{runtimeReadiness.blockers.map((blocker, index) => <li key={`${blocker.code}-${blocker.nodeId ?? index}`}>{blocker.message}</li>)}</ul></div> : null}
    </section>
  );
}
