import type { AutomationBuilderNodeSummary } from './AutomationBuilderShell';
import { updateAutomationWorkflowNodeConfigDraft } from './actions';

export function AutomationWorkflowNodeConfigDraftForm({
  canManage,
  nodes,
  projectSlug,
  tenantSlug,
  workflowSlug,
}: {
  canManage: boolean;
  nodes: AutomationBuilderNodeSummary[];
  tenantSlug: string;
  projectSlug: string;
  workflowSlug: string;
}) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6">
        <h3 className="text-base font-semibold">Node configuration drafts are protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Only managers can edit node draft metadata. Runtime settings, credentials, triggers, webhook activation, execution,
          retries, and publishing remain disabled.
        </p>
      </section>
    );
  }

  const configurableNodes = nodes.filter((node) => node.canConfigure);

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Node configuration drafts</p>
        <h3 className="mt-1 text-base font-semibold">Configure node metadata</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Add an optional label and internal notes to supported nodes. Existing configuration is preserved. No executable
          settings, credentials, activation controls, retries, or provider connections are exposed here.
        </p>
      </div>

      {configurableNodes.length ? (
        <div className="mt-5 grid gap-4">
          {configurableNodes.map((node) => (
            <form action={updateAutomationWorkflowNodeConfigDraft} className="grid gap-4 rounded-xl border bg-background p-4" key={node.id}>
              <input name="tenantSlug" type="hidden" value={tenantSlug} />
              <input name="projectSlug" type="hidden" value={projectSlug} />
              <input name="workflowSlug" type="hidden" value={workflowSlug} />
              <input name="nodeId" type="hidden" value={node.id} />

              <div>
                <h4 className="text-sm font-semibold">Configure {node.type} · {node.id}</h4>
                <p className="mt-1 text-xs text-muted-foreground">Draft metadata only</p>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Node label
                <input
                  className="rounded-md border bg-card px-3 py-2 text-sm"
                  defaultValue={node.configDraft.label}
                  maxLength={120}
                  name="label"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Notes for {node.id}
                <textarea
                  className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm"
                  defaultValue={node.configDraft.notes}
                  maxLength={500}
                  name="notes"
                />
              </label>

              <button className="w-fit rounded-md border px-3 py-2 text-sm font-medium" type="submit">
                Save {node.id} draft config
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Add a supported node with a stable id before configuring draft metadata.</p>
      )}
    </section>
  );
}
