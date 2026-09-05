type DeployCapabilityStatus = 'planned' | 'protected';

type DeployWorkspaceCapability = {
  key: 'apps' | 'environments' | 'deployments' | 'domains' | 'previews' | 'production';
  title: string;
  description: string;
  statusLabel: string;
  status: DeployCapabilityStatus;
  href?: string;
};

type BuildDeployWorkspaceCapabilitiesOptions = {
  projectSlug: string;
  tenantSlug: string;
};

export function buildDeployWorkspaceCapabilities(_options: BuildDeployWorkspaceCapabilitiesOptions): DeployWorkspaceCapability[] {
  return [
    {
      key: 'apps',
      title: 'Apps & websites',
      description: 'Prepare the project surface for web apps, websites, APIs, portals, and customer-facing products.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'environments',
      title: 'Environments',
      description: 'Model development, preview, staging, and production environments before provider automation is enabled.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'deployments',
      title: 'Deployments',
      description: 'Reserve deployment history, status, logs, rollback notes, and release metadata for future infrastructure runs.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'domains',
      title: 'Domains',
      description: 'Prepare domain mapping for mkety.app previews, custom domains, DNS checks, SSL state, and ownership verification.',
      status: 'protected',
      statusLabel: 'Protected',
    },
    {
      key: 'previews',
      title: 'Previews',
      description: 'Expose preview-deployment planning without provisioning public preview URLs until routing rules are implemented.',
      status: 'planned',
      statusLabel: 'Planned',
    },
    {
      key: 'production',
      title: 'Production',
      description: 'Keep production release controls protected until approvals, audit logs, provider credentials, and rollback safety exist.',
      status: 'protected',
      statusLabel: 'Protected',
    },
  ];
}

export function DeployWorkspaceOverview({ projectSlug, tenantSlug }: BuildDeployWorkspaceCapabilitiesOptions) {
  const capabilities = buildDeployWorkspaceCapabilities({ projectSlug, tenantSlug });

  return (
    <section aria-labelledby="deploy-workspace-overview-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Deploy Workspace foundation</p>
          <h2 className="mt-1 text-xl font-semibold" id="deploy-workspace-overview-heading">
            Prepare apps, environments, and releases safely
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This overview exposes the Mkety deployment product surface while keeping Cloudflare, OCI, DNS, preview routing,
            production releases, and provider automation behind planned or protected states.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">Infrastructure protected</span>
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
        Deploy automation remains intentionally inactive in this branch. The next backend slice should add app records,
        environments, deployment records, domain ownership checks, provider credential boundaries, approvals, and audit logs
        before any real infrastructure changes can run.
      </p>
    </section>
  );
}
