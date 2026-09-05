import { createAutomationWorkflowDraft } from './actions';

export function AutomationWorkflowDraftForm({
  canManage,
  projectSlug,
  tenantSlug,
}: {
  tenantSlug: string;
  projectSlug: string;
  canManage: boolean;
}) {
  if (!canManage) {
    return (
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold">Workflow drafts are manager-controlled</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Only workspace managers and admins can create workflow drafts. Existing workflow records remain visible as read-only
          automation context.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 md:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Draft-only creation</p>
        <h2 className="mt-1 text-lg font-semibold">Create workflow draft</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create a manual draft record that opens in the read-only builder shell. Execution, activation, webhooks, retries, and
          action dispatch remain disabled.
        </p>
      </div>

      <form action={createAutomationWorkflowDraft} className="mt-5 grid gap-4 md:grid-cols-2">
        <input name="tenantSlug" type="hidden" value={tenantSlug} />
        <input name="projectSlug" type="hidden" value={projectSlug} />
        <label className="space-y-2 text-sm font-medium">
          Workflow name
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="name"
            placeholder="Lead follow-up"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Description
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="description"
            placeholder="What should this workflow eventually automate?"
          />
        </label>
        <div className="md:col-span-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
            Create draft workflow
          </button>
        </div>
      </form>
    </section>
  );
}
