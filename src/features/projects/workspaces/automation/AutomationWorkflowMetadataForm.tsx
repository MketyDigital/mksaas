import { updateAutomationWorkflowMetadata } from './actions';

export function AutomationWorkflowMetadataForm({
  canManage,
  projectSlug,
  tenantSlug,
  workflow,
}: {
  canManage: boolean;
  tenantSlug: string;
  projectSlug: string;
  workflow: {
    name: string;
    slug: string;
    description: string | null;
  };
}) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5 md:p-6">
        <h3 className="text-base font-semibold">Workflow details are protected</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Only managers can edit workflow details. Runtime controls, trigger changes, node editing, webhook activation, and execution remain disabled.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Draft metadata</p>
        <h3 className="mt-1 text-base font-semibold">Edit workflow details</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Update the workflow name and description only. Nodes, triggers, activation, execution, publishing, retries, and action dispatch remain protected.
        </p>
      </div>

      <form action={updateAutomationWorkflowMetadata} className="mt-5 grid gap-4">
        <input name="tenantSlug" type="hidden" value={tenantSlug} />
        <input name="projectSlug" type="hidden" value={projectSlug} />
        <input name="workflowSlug" type="hidden" value={workflow.slug} />

        <label className="grid gap-2 text-sm font-medium">
          Workflow name
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={workflow.name}
            name="name"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Description
          <textarea
            className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={workflow.description || ''}
            name="description"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
            Save workflow details
          </button>
          <span className="text-xs text-muted-foreground">Metadata only. Execution remains disabled.</span>
        </div>
      </form>
    </section>
  );
}
