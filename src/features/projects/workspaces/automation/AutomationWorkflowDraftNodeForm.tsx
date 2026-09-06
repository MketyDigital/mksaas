import { addAutomationWorkflowDraftNode } from './actions';

const draftNodeTypeOptions = [
  { label: 'Trigger', value: 'trigger' },
  { label: 'Agent', value: 'agent' },
  { label: 'HTTP', value: 'http' },
  { label: 'Transform', value: 'transform' },
  { label: 'Condition', value: 'condition' },
];

export function AutomationWorkflowDraftNodeForm({
  canManage,
  projectSlug,
  tenantSlug,
  workflowSlug,
}: {
  canManage: boolean;
  tenantSlug: string;
  projectSlug: string;
  workflowSlug: string;
}) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6">
        <h3 className="text-base font-semibold">Draft nodes are protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Only managers can add draft nodes. Execution, trigger scheduling, webhook activation, credentials, action dispatch,
          and retries remain disabled.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Draft node preparation</p>
        <h3 className="mt-1 text-base font-semibold">Add draft node</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Add a supported node placeholder with empty config. This prepares the workflow structure only; execution, activation,
          credentials, retries, and action dispatch remain disabled.
        </p>
      </div>

      <form action={addAutomationWorkflowDraftNode} className="mt-5 grid gap-4 md:grid-cols-[minmax(0,20rem)_auto] md:items-end">
        <input name="tenantSlug" type="hidden" value={tenantSlug} />
        <input name="projectSlug" type="hidden" value={projectSlug} />
        <input name="workflowSlug" type="hidden" value={workflowSlug} />

        <label className="grid gap-2 text-sm font-medium">
          Node type
          <select className="rounded-md border bg-background px-3 py-2 text-sm" name="nodeType" required>
            {draftNodeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
          Add draft node
        </button>
      </form>
    </section>
  );
}
