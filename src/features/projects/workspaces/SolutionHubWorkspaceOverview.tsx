import Link from 'next/link';

import {
  getSolutionHubEntriesByClass,
  getSolutionHubEntryCtaLabel,
  getSolutionHubEntryDestination,
} from './solutionhub/catalog';

type SolutionHubWorkspaceOverviewProps = {
  projectSlug: string;
  tenantSlug: string;
};

export function SolutionHubWorkspaceOverview({
  projectSlug,
  tenantSlug,
}: SolutionHubWorkspaceOverviewProps) {
  const sharedEntries = getSolutionHubEntriesByClass('shared-platform');
  const enterpriseEntries = getSolutionHubEntriesByClass('enterprise-custom');
  const context = { projectSlug, tenantSlug };

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="solutionhub-workspace-overview-heading"
        className="rounded-2xl border bg-card p-5 md:p-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">SolutionHub</p>
            <h2
              className="mt-1 text-xl font-semibold"
              id="solutionhub-workspace-overview-heading"
            >
              Start from a proven solution path
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Explore common Mkety solution patterns, then continue in the workspace that actually
              builds the capability. SolutionHub does not silently install infrastructure or bypass
              project, entitlement, billing, or approval boundaries.
            </p>
          </div>
          <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Catalog available
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-2xl font-semibold">{sharedEntries.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Shared-platform paths</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-2xl font-semibold">{enterpriseEntries.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Enterprise / Custom paths</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-2xl font-semibold">0</p>
            <p className="mt-1 text-xs text-muted-foreground">One-click installs enabled</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="solutionhub-shared-heading" className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Class A · Shared platform
          </p>
          <h2 className="mt-1 text-lg font-semibold" id="solutionhub-shared-heading">
            Build with existing Mkety workspaces
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            These bounded solution patterns fit Mkety shared/serverless capabilities. Opening one
            takes you to the relevant project workspace; it does not auto-create billable resources.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sharedEntries.map((entry) => (
            <article className="flex h-full flex-col rounded-2xl border bg-card p-5" key={entry.key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {entry.category}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{entry.title}</h3>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  Shared
                </span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                {entry.description}
              </p>
              <Link
                className="mt-5 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                href={getSolutionHubEntryDestination(entry, context)}
              >
                {getSolutionHubEntryCtaLabel(entry)}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="solutionhub-enterprise-heading"
        className="space-y-4 rounded-2xl border border-dashed bg-card p-5 md:p-6"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Class B · Enterprise / Custom
          </p>
          <h2 className="mt-1 text-lg font-semibold" id="solutionhub-enterprise-heading">
            Requirements that need reviewed delivery
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Dedicated infrastructure, regulated or substantial data systems, complex transactional
            platforms, persistent services, private networking, strict SLA needs, and specialized
            Trading remain reviewed Enterprise work.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {enterpriseEntries.map((entry) => (
            <article className="flex h-full flex-col rounded-xl border bg-background p-4" key={entry.key}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{entry.title}</h3>
                <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                  Custom
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.description}</p>
              {entry.enterpriseReason ? (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {entry.enterpriseReason}
                </p>
              ) : null}
              <Link
                className="mt-4 w-fit rounded-md border px-3 py-2 text-sm font-medium"
                href={getSolutionHubEntryDestination(entry, context)}
              >
                {getSolutionHubEntryCtaLabel(entry)}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        SolutionHub is now an authenticated discovery and routing surface. Clone/install,
        provisioning, entitlement mutation, checkout creation, and infrastructure allocation remain
        disabled until a later audited implementation introduces those contracts explicitly.
      </p>
    </div>
  );
}
