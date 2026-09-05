type SolutionHubCapabilityStatus = 'planned' | 'protected';

type SolutionHubCapability = {
  key: 'templates' | 'ready-made-solutions' | 'blueprints' | 'enterprise-requests' | 'academy-linked' | 'install-flow';
  title: string;
  description: string;
  status: SolutionHubCapabilityStatus;
  statusLabel: string;
};

export function buildSolutionHubCapabilities(): SolutionHubCapability[] {
  return [
    {
      key: 'templates',
      title: 'Templates',
      description: 'Package reusable project starters for AI agents, automations, websites, apps, and business workflows.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'ready-made-solutions',
      title: 'Ready-made solutions',
      description: 'Present complete business systems that customers can request, adapt, or deploy through Mkety-assisted delivery.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'blueprints',
      title: 'Blueprints',
      description: 'Expose implementation maps for common systems before turning them into installable product packages.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'enterprise-requests',
      title: 'Enterprise requests',
      description: 'Route complex custom work into a reviewed request path instead of pretending everything is self-service.',
      status: 'protected',
      statusLabel: 'Protected',
    },
    {
      key: 'academy-linked',
      title: 'Academy-linked solutions',
      description: 'Connect training, playbooks, and guided implementation paths without merging Mkety Academy into the Platform core.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'install-flow',
      title: 'Install/request flow',
      description: 'Reserve future install, clone, request, and approval flows until billing, entitlement, and tenant-safety rules exist.',
      status: 'protected',
      statusLabel: 'Protected',
    },
  ];
}

export function SolutionHubWorkspaceOverview() {
  const capabilities = buildSolutionHubCapabilities();

  return (
    <section aria-labelledby="solutionhub-workspace-overview-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">SolutionHub foundation</p>
          <h2 className="mt-1 text-xl font-semibold" id="solutionhub-workspace-overview-heading">
            Package repeatable business systems safely
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This overview defines the SolutionHub catalog surface while keeping install, clone, enterprise request,
            entitlement, and billing-sensitive behavior inactive until their backend rules exist.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Catalog planned</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {capabilities.map((capability) => (
          <article key={capability.key} className="h-full rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{capability.title}</h3>
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{capability.statusLabel}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{capability.description}</p>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        SolutionHub remains a catalog foundation in this branch. Future slices should add tenant-scoped catalog records,
        install/request reviews, entitlement checks, billing boundaries, and audit trails before any solution can be cloned or installed.
      </p>
    </section>
  );
}
