import { CreditCard, ExternalLink, ReceiptText, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SELF_SERVICE_BILLING_PLANS } from '@/features/billing/catalog/self-service-plans';
import {
  drizzleBillingSummarySource,
  getTenantCurrentSubscriptions,
} from '@/features/billing/server/drizzle-queries';
import { getTenantBillingSummary } from '@/features/billing/server/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { withRequestDatabase } from '@/shared/db/request';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

function money(amountMinor: bigint, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

async function renderBillingHome({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [subscriptions, summary] = await Promise.all([
    getTenantCurrentSubscriptions(tenant.id),
    getTenantBillingSummary(drizzleBillingSummarySource, tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Plan & billing</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Manage the active products on {tenant.name}, review verified payment activity and add supported self-service products.
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Active subscriptions</h2>
          <Link className="text-sm font-semibold text-primary" href={`/app/${tenantSlug}/wallet`}>
            Usage & credits →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {subscriptions.map((subscription) => (
            <Card className="rounded-2xl" key={subscription.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{subscription.planName}</CardTitle>
                    <CardDescription>{subscription.planKey} · version {subscription.planVersion}</CardDescription>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold">{subscription.status}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Current period</span><strong>{money(subscription.amountDueMinor, subscription.currency)}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Renewal</span><span>{subscription.renewalMode}{subscription.autoRenew ? ' · auto-renew' : ''}</span></div>
                {subscription.periodEnd ? <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Period ends</span><span>{subscription.periodEnd.toLocaleDateString()}</span></div> : null}
                {subscription.planKey.startsWith('mail-') ? (
                  <Link className="inline-flex font-semibold text-primary" href={`/app/${tenantSlug}/mail`}>Open Mkety Mail →</Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {!subscriptions.length ? (
            <Card className="rounded-2xl md:col-span-2">
              <CardHeader><CardTitle>No active paid subscription</CardTitle><CardDescription>You can add a self-service product below. Enterprise products remain contract/entitlement based.</CardDescription></CardHeader>
            </Card>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />Recent verified payments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary?.recentSettlements.length ? summary.recentSettlements.map((settlement) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm" key={settlement.id}>
                <div><p className="font-medium">{settlement.provider}</p><p className="text-xs text-muted-foreground">{settlement.occurredAt.toLocaleDateString()} · {settlement.status}</p></div>
                <strong>{money(settlement.amountPaidMinor, settlement.currencyPaid)}</strong>
              </div>
            )) : <p className="text-sm text-muted-foreground">No recent verified settlement is available.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" />Billing ledger</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary?.recentLedger.length ? summary.recentLedger.map((entry) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm" key={entry.id}>
                <div><p className="font-medium">{entry.entryType}</p><p className="text-xs text-muted-foreground">{entry.createdAt.toLocaleDateString()}</p></div>
                <strong>{money(entry.amountMinor, entry.currency)}</strong>
              </div>
            )) : <p className="text-sm text-muted-foreground">No recent billing ledger entries are available.</p>}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-bold">Add or change a self-service product</h2>
        <p className="mt-1 text-sm text-muted-foreground">Platform-family and Mail-family subscriptions can coexist. Checkout remains server-priced and access is granted only after verified settlement.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.values(SELF_SERVICE_BILLING_PLANS).map((plan) => (
            <Card className="rounded-2xl" key={plan.key}>
              <CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.description}</CardDescription></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{money(plan.amountMinor, plan.currency)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                <Link className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:border-primary/50" href={`/app/${tenantSlug}/billing/checkout?plan=${encodeURIComponent(plan.key)}`}>
                  <CreditCard className="h-4 w-4" /> View checkout
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Other Mkety products</CardTitle><CardDescription>Standalone products keep their existing runtime and product-specific commercial rules while linking back to the same Mkety ecosystem.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/media`}>Mkety Media <ExternalLink className="h-4 w-4" /></Link>
          <a className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" href="https://mkety.com/enterprise">Enterprise products <ExternalLink className="h-4 w-4" /></a>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function BillingHome(props: { params: Promise<{ tenant: string }> }) {
  return withRequestDatabase(() => renderBillingHome(props));
}
