import Link from 'next/link';

import type { ProjectWorkspaceDefinition, WorkspaceAvailability } from './types';

const readinessLabels: Record<WorkspaceAvailability, string> = {
  available: 'Available now',
  enterprise: 'Enterprise only',
  planned: 'Planned next',
  protected: 'Protected',
};

export function WorkspaceHub({
  projectDescription,
  projectName,
  projectSlug,
  tenantSlug,
  workspaces,
}: {
  tenantSlug: string;
  projectSlug: string;
  projectName: string;
  projectDescription?: string | null;
  workspaces: ProjectWorkspaceDefinition[];
}) {
  const readinessCounts = workspaces.reduce(
    (counts, workspace) => ({
      ...counts,
      [workspace.availability]: counts[workspace.availability] + 1,
    }),
    { available: 0, enterprise: 0, planned: 0, protected: 0 } satisfies Record<WorkspaceAvailability, number>,
  );

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border bg-card p-6 md:p-8">
        <p className="text-sm font-medium text-muted-foreground">Mkety Project</p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{projectName}</h1>
        {projectDescription && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{projectDescription}</p>}
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
          Open the right workspace for this project. AI is available now, while Automate, Deploy, SolutionHub, and enterprise Trading are staged behind clear product boundaries.
        </p>
      </header>

      <section aria-labelledby="workspace-readiness-heading" className="grid gap-3 md:grid-cols-4">
        <h2 id="workspace-readiness-heading" className="sr-only">
          Workspace readiness
        </h2>
        {(Object.keys(readinessLabels) as WorkspaceAvailability[]).map((availability) => (
          <div key={availability} className="rounded-2xl border bg-card p-4">
            <p className="text-2xl font-semibold">{readinessCounts[availability]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{readinessLabels[availability]}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="project-workspaces-heading" className="space-y-4">
        <div>
          <h2 id="project-workspaces-heading" className="text-lg font-semibold">
            Project workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Each workspace is tenant-scoped and project-scoped before it can access product data.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const href = `/t/${tenantSlug}/projects/${projectSlug}/${workspace.hrefSegment}`;
            return (
              <article key={workspace.key} className="flex min-h-64 flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{workspace.shortTitle}</p>
                    <h3 className="mt-2 text-xl font-semibold">{workspace.title}</h3>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">{workspace.statusLabel}</span>
                </div>
                <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{workspace.description}</p>
                {workspace.protectedReason && <p className="mt-4 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">{workspace.protectedReason}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={href} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                    {workspace.primaryCtaLabel}
                  </Link>
                  {workspace.secondaryCtaLabel && (
                    <Link href={href} className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted/70">
                      {workspace.secondaryCtaLabel}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
