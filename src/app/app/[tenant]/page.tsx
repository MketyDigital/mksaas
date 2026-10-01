import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Bot,
  Boxes,
  ChartNoAxesCombined,
  CreditCard,
  FolderKanban,
  Image,
  Mail,
  Rocket,
  Sparkles,
  Users,
  WalletCards,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';

import { getDashboardStats } from '@/features/dashboard/actions';
import { getEnterpriseAiContractBillingState } from '@/features/ai-runtime/server/enterprise-contracts';
import { getTenantEntitlementsForRequest } from '@/features/entitlements/server/resolver';
import {
  getPublishedDashboardSettings,
  getPublishedWorkspaceCardsForTenant,
} from '@/features/platform-app-experience/server/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { withRequestDatabase } from '@/shared/db/request';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface TenantDashboardProps {
  params: Promise<{ tenant: string }>;
}

const WORKSPACE_ICONS = {
  ai: Sparkles,
  automation: Workflow,
  deploy: Rocket,
  solutions: Boxes,
  trading: ChartNoAxesCombined,
} as const;

function workspaceHref(tenantSlug: string, key: string, configuredHref: string) {
  if (['ai', 'automation', 'deploy', 'solutions', 'trading'].includes(key)) {
    return `/app/${tenantSlug}/projects`;
  }
  if (configuredHref.startsWith('/t/')) return configuredHref;
  return configuredHref;
}

async function renderTenantDashboard({ params }: TenantDashboardProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const [statsResult, dashboard, workspaces, entitlements, enterpriseAiContractState] = await Promise.all([
    getDashboardStats(tenant.slug),
    getPublishedDashboardSettings(),
    getPublishedWorkspaceCardsForTenant(tenant.id),
    getTenantEntitlementsForRequest(tenant.id),
    getEnterpriseAiContractBillingState(tenant.id),
  ]);
  const stats = statsResult.success ? statsResult.data : null;
  const allowed = new Set(entitlements.filter((item) => item.allowed).map((item) => item.entitlement));
  const hasMail = allowed.has('workspace.mail');
  const hasEnterpriseAi = allowed.has('workspace.ai.enterprise');
  const hasEnterpriseAiContract = Boolean(enterpriseAiContractState.contract);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety Platform</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight md:text-4xl">
          {dashboard.headline}
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">{dashboard.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href={`/app/${tenantSlug}/projects`}>
            Open projects
          </Link>
          <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/billing`}>
            Billing & plan
          </Link>
          <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/wallet`}>
            Usage & credits
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Your workspaces</h2>
            <p className="text-sm text-muted-foreground">Only products enabled for {tenant.name} are shown here.</p>
          </div>
          <Link className="text-sm font-semibold text-primary" href={`/app/${tenantSlug}/projects`}>Manage projects →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const Icon = WORKSPACE_ICONS[workspace.key as keyof typeof WORKSPACE_ICONS] ?? Boxes;
            return (
              <Link
                className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                href={workspaceHref(tenantSlug, workspace.key, workspace.href)}
                key={workspace.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  {workspace.badgeLabel ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{workspace.badgeLabel}</span> : null}
                </div>
                <h3 className="mt-4 font-semibold">{workspace.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{workspace.description}</p>
                <p className="mt-4 text-sm font-semibold text-primary">Open workspace →</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">Products & account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/projects`}>
            <FolderKanban className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Projects</p>
            <p className="mt-1 text-sm text-muted-foreground">Your apps, agents, automations and deployments.</p>
          </Link>
          <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/billing`}>
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Plan & billing</p>
            <p className="mt-1 text-sm text-muted-foreground">Subscription, invoices and payment options.</p>
          </Link>
          <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/wallet`}>
            <WalletCards className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Usage & credits</p>
            <p className="mt-1 text-sm text-muted-foreground">Available credits, usage and hard limits.</p>
          </Link>
          {hasMail ? (
            <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/mail`}>
              <Mail className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Mkety Mail</p>
              <p className="mt-1 text-sm text-muted-foreground">Business inboxes, domains, sending and contacts.</p>
            </Link>
          ) : null}
          {hasEnterpriseAi ? (
            <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/enterprise-ai`}>
              <Bot className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Enterprise AI</p>
              <p className="mt-1 text-sm text-muted-foreground">Customer AI, channels, domains, branding and usage.</p>
            </Link>
          ) : hasEnterpriseAiContract ? (
            <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/enterprise-ai`}>
              <Bot className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Enterprise AI · Agreement ready</p>
              <p className="mt-1 text-sm text-muted-foreground">Review your Enterprise AI agreement, choose a payment method and activate access.</p>
            </Link>
          ) : (
            <a className="rounded-2xl border bg-card p-5 hover:border-primary/50" href="https://mkety.com/enterprise">
              <Bot className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Enterprise AI</p>
              <p className="mt-1 text-sm text-muted-foreground">Request branded customer AI, channels, domains and enterprise controls.</p>
            </a>
          )}
          {!hasMail ? (
            <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/billing/checkout?plan=mail-starter`}>
              <Mail className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">Add Mkety Mail</p>
              <p className="mt-1 text-sm text-muted-foreground">Add professional business email to this workspace.</p>
            </Link>
          ) : null}
          <Link className="rounded-2xl border bg-card p-5 hover:border-primary/50" href={`/app/${tenantSlug}/media`}>
            <Image className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Mkety Media</p>
            <p className="mt-1 text-sm text-muted-foreground">View this workspace&apos;s Media connection, then open the existing standalone Media product.</p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team members</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.teamSize ?? 0}</div></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent activity</CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.recentActivity.length ?? 0}</div></CardContent>
        </Card>
      </section>

      {stats?.recentActivity.length ? (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 8).map((event) => (
                <div className="flex items-center justify-between gap-4 rounded-xl border p-3" key={event.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.action}</p>
                    <p className="text-xs text-muted-foreground">{event.entityType ?? 'Platform activity'}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default async function TenantDashboard(props: TenantDashboardProps) {
  return withRequestDatabase(() => renderTenantDashboard(props));
}
