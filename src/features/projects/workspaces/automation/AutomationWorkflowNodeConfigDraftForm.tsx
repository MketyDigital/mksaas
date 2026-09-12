import { updateAutomationWorkflowNodeConfigDraft } from './actions';
import type { AutomationBuilderNodeSummary } from './AutomationBuilderShell';

function TypeSpecificFields({ node }: { node: AutomationBuilderNodeSummary }) {
  const draft = node.typeConfigDraft;

  if (node.type === 'trigger') {
    return (
      <label className="grid gap-2 text-sm font-medium">
        Trigger mode for {node.id}
        <select className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.triggerMode} name="triggerMode">
          <option value="">Not selected</option>
          <option value="manual">Manual</option>
          <option value="webhook">Webhook draft</option>
          <option value="schedule">Schedule draft</option>
        </select>
      </label>
    );
  }

  if (node.type === 'agent') {
    return (
      <>
        <label className="grid gap-2 text-sm font-medium">Agent ID for {node.id}<input className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.agentId} maxLength={160} name="agentId" /></label>
        <label className="grid gap-2 text-sm font-medium">Prompt draft for {node.id}<textarea className="min-h-24 rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.prompt} maxLength={4000} name="prompt" /></label>
      </>
    );
  }

  if (node.type === 'http') {
    return (
      <>
        <label className="grid gap-2 text-sm font-medium">HTTP method for {node.id}<select className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.method} name="method"><option value="">Not selected</option>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Request URL draft for {node.id}<input className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.url} maxLength={2048} name="url" placeholder="https://api.example.com/resource" /></label>
        <label className="grid gap-2 text-sm font-medium">Headers draft for {node.id}<textarea className="min-h-20 rounded-md border bg-card px-3 py-2 font-mono text-xs" defaultValue={draft.headers} maxLength={4000} name="headers" /></label>
        <label className="grid gap-2 text-sm font-medium">Body draft for {node.id}<textarea className="min-h-24 rounded-md border bg-card px-3 py-2 font-mono text-xs" defaultValue={draft.body} maxLength={10000} name="body" /></label>
      </>
    );
  }

  if (node.type === 'transform') {
    return (
      <>
        <label className="grid gap-2 text-sm font-medium">Input draft for {node.id}<textarea className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.input} maxLength={2000} name="input" /></label>
        <label className="grid gap-2 text-sm font-medium">Mapping draft for {node.id}<textarea className="min-h-24 rounded-md border bg-card px-3 py-2 font-mono text-xs" defaultValue={draft.mapping} maxLength={6000} name="mapping" /></label>
      </>
    );
  }

  if (node.type === 'condition') {
    return (
      <>
        <label className="grid gap-2 text-sm font-medium">Condition field for {node.id}<input className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.field} maxLength={200} name="field" /></label>
        <label className="grid gap-2 text-sm font-medium">Condition operator for {node.id}<select className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.operator} name="operator"><option value="">Not selected</option><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Condition value for {node.id}<input className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={draft.value} maxLength={2000} name="value" /></label>
      </>
    );
  }

  return null;
}

export function AutomationWorkflowNodeConfigDraftForm({ canManage, nodes, projectSlug, tenantSlug, workflowSlug }: { canManage: boolean; nodes: AutomationBuilderNodeSummary[]; tenantSlug: string; projectSlug: string; workflowSlug: string }) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6">
        <h3 className="text-base font-semibold">Node configuration drafts are protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">Only managers can edit node draft configuration. Runtime settings, credentials, webhook activation, scheduler activation, execution, retries, and publishing remain disabled.</p>
      </section>
    );
  }

  const configurableNodes = nodes.filter((node) => node.canConfigure);

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Node configuration drafts</p>
        <h3 className="mt-1 text-base font-semibold">Configure node drafts</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Prepare safe metadata and type-specific configuration. These values are stored as drafts only; no agent, HTTP request, trigger, transform, or condition is executed from this surface.</p>
      </div>

      {configurableNodes.length ? (
        <div className="mt-5 grid gap-4">
          {configurableNodes.map((node) => (
            <form action={updateAutomationWorkflowNodeConfigDraft} className="grid gap-4 rounded-xl border bg-background p-4" key={node.id}>
              <input name="tenantSlug" type="hidden" value={tenantSlug} />
              <input name="projectSlug" type="hidden" value={projectSlug} />
              <input name="workflowSlug" type="hidden" value={workflowSlug} />
              <input name="nodeId" type="hidden" value={node.id} />
              <div><h4 className="text-sm font-semibold">Configure {node.type} · {node.id}</h4><p className="mt-1 text-xs text-muted-foreground">Draft configuration only · execution disabled</p></div>
              <label className="grid gap-2 text-sm font-medium">Node label<input className="rounded-md border bg-card px-3 py-2 text-sm" defaultValue={node.configDraft.label} maxLength={120} name="label" /></label>
              <label className="grid gap-2 text-sm font-medium">Notes for {node.id}<textarea className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm" defaultValue={node.configDraft.notes} maxLength={500} name="notes" /></label>
              <TypeSpecificFields node={node} />
              <button className="w-fit rounded-md border px-3 py-2 text-sm font-medium" type="submit">Save {node.id} draft config</button>
            </form>
          ))}
        </div>
      ) : <p className="mt-5 text-sm text-muted-foreground">Add a supported node with a stable id before configuring drafts.</p>}
    </section>
  );
}
