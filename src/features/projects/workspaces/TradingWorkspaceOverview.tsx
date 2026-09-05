type TradingWorkspaceSurfaceStatus = 'planned' | 'protected' | 'blocked';

type TradingWorkspaceSurface = {
  key: 'enterprise-intake' | 'strategy-ops' | 'broker-integrations' | 'signals' | 'copy-trading' | 'execution';
  title: string;
  description: string;
  status: TradingWorkspaceSurfaceStatus;
  statusLabel: string;
};

export const tradingWorkspaceSurfaces: TradingWorkspaceSurface[] = [
  {
    key: 'enterprise-intake',
    title: 'Enterprise intake',
    description:
      'Capture custom trading-system requirements for regulated, tenant-specific implementations without enabling self-service trading features.',
    status: 'planned',
    statusLabel: 'Planned',
  },
  {
    key: 'strategy-ops',
    title: 'Strategy operations',
    description:
      'Reserve a future space for approved internal strategy documentation, operating playbooks, and non-execution trading workflows.',
    status: 'planned',
    statusLabel: 'Planned',
  },
  {
    key: 'broker-integrations',
    title: 'Broker integrations',
    description:
      'Broker, MT5, Deriv, API-key, account-linking, and revenue-share integrations are intentionally not available in this branch.',
    status: 'protected',
    statusLabel: 'Protected',
  },
  {
    key: 'signals',
    title: 'Signals',
    description:
      'Signal creation, publishing, subscription access, performance tracking, and financial-result claims are outside this workspace shell.',
    status: 'blocked',
    statusLabel: 'Not implemented',
  },
  {
    key: 'copy-trading',
    title: 'Copy trading',
    description:
      'Copy-trading flows, copier access, trade mirroring, allocation rules, and account execution permissions are explicitly excluded.',
    status: 'blocked',
    statusLabel: 'Not implemented',
  },
  {
    key: 'execution',
    title: 'Execution',
    description:
      'Order placement, position management, trade history, P&L calculation, stop-loss/take-profit handling, and broker execution are blocked.',
    status: 'blocked',
    statusLabel: 'Not implemented',
  },
];

export function TradingWorkspaceOverview() {
  return (
    <section aria-labelledby="trading-workspace-overview-heading" className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Trading Workspace boundary</p>
          <h2 className="mt-1 text-xl font-semibold" id="trading-workspace-overview-heading">
            Custom enterprise systems only
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Trading remains visible in Mkety because customer-specific trading systems may be built as enterprise projects.
            This route is not a live trading product, signal service, broker portal, or copy-trading engine.
          </p>
        </div>
        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Enterprise gated
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tradingWorkspaceSurfaces.map((surface) => (
          <article key={surface.key} className="h-full rounded-xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{surface.title}</h3>
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{surface.statusLabel}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{surface.description}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-xl border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold">Explicitly excluded from this branch</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No trading accounts, broker links, API credentials, signals, copy trading, order execution, MT5/Deriv integration,
          subscription access, financial-performance claims, or P&amp;L calculations are introduced here.
        </p>
      </div>
    </section>
  );
}
