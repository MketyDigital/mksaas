import { updateAutomationWorkflowNodeStructureDraft } from './actions';
import type { AutomationBuilderNodeSummary } from './AutomationBuilderShell';

function StructureButton({ operation, children }: { operation: string; children: React.ReactNode }) {
  return (
    <button className="rounded-md border px-3 py-2 text-xs font-medium" name="operation" type="submit" value={operation}>
      {children}
    </button>
  );
}

export function AutomationWorkflowNodeStructureDraftForm({
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
        <h3 className="text-base font-semibold">Workflow structure drafts are protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">Only managers can move, duplicate, or delete supported draft nodes. Execution and activation remain disabled.</p>
      </section>
    );
  }

  const editableNodes = nodes.filter((node) => node.canConfigure);

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Workflow structure drafts</p>
        <h3 className="mt-1 text-base font-semibold">Arrange draft nodes</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Reorder, duplicate, or remove supported draft nodes. Unknown nodes stay inspection-only. These controls never execute or activate the workflow.</p>
      </div>

      {editableNodes.length ? (
        <div className="mt-5 grid gap-3">
          {nodes.map((node, index) => node.canConfigure ? (
            <form action={updateAutomationWorkflowNodeStructureDraft} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4" key={node.id}>
              <input name="tenantSlug" type="hidden" value={tenantSlug} />
              <input name="projectSlug" type="hidden" value={projectSlug} />
              <input name="workflowSlug" type="hidden" value={workflowSlug} />
              <input name="nodeId" type="hidden" value={node.id} />
              <div><p className="text-sm font-semibold">{node.type} · {node.id}</p><p className="mt-1 text-xs text-muted-foreground">Structure only · runtime disabled</p></div>
              <div className="flex flex-wrap gap-2">
                {index > 0 ? <StructureButton operation="move-up">Move up</StructureButton> : null}
                {index < nodes.length - 1 ? <StructureButton operation="move-down">Move down</StructureButton> : null}
                <StructureButton operation="duplicate">Duplicate</StructureButton>
                <StructureButton operation="delete">Delete draft node</StructureButton>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-background p-4" key={`${node.id}-${index}`}>
              <div><p className="text-sm font-semibold">{node.type} · {node.id}</p><p className="mt-1 text-xs text-muted-foreground">Inspection-only node</p></div>
              <span className="text-xs text-muted-foreground">Structure controls protected</span>
            </div>
          ))}
        </div>
      ) : <p className="mt-5 text-sm text-muted-foreground">Add a supported node with a stable id before editing workflow structure.</p>}
    </section>
  );
}
