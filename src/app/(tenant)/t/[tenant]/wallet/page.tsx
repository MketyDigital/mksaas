import { Coins, CreditCard, ReceiptText, WalletCards } from 'lucide-react';

import { getTenantWalletSummary } from '@/features/wallet/server/summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/ui/page-header';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface WalletPageProps {
  params: Promise<{ tenant: string }>;
}

function formatMinorUnits(amountMinor: bigint, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(Number(amountMinor) / 10 ** fractionDigits);
}

function formatDate(value: Date | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(value);
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  await auth();

  const wallet = tenant?.id ? await getTenantWalletSummary(tenant.id) : null;
  const billing = wallet?.billing;
  const credits = wallet?.productCredits;

  return (
    <div className="space-y-8">
      <PageHeader
        variant="hero"
        icon={<WalletCards className="h-5 w-5" aria-hidden />}
        title="Wallet"
        description="Your read-only Mkety commercial account, billing activity, settlements and product credits."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-xl border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current bill</CardTitle>
            <CreditCard className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {billing ? formatMinorUnits(billing.currentPeriod.amountDueMinor, billing.currentPeriod.currency) : '—'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {billing
                ? `${billing.plan.name} · ${billing.subscription.status} · ends ${formatDate(billing.currentPeriod.end)}`
                : 'No active billing period'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Product credits</CardTitle>
            <Coins className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{credits?.availableCredits.toString() ?? '0'}</div>
            <p className="mt-1 text-xs text-muted-foreground">Usage credits are not cash and cannot be withdrawn or transferred.</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent settlements</CardTitle>
            <ReceiptText className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{billing?.recentSettlements.length ?? 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Verified payment records shown from Mkety Billing.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-0 shadow-md">
          <CardHeader><CardTitle>Billing activity</CardTitle></CardHeader>
          <CardContent>
            {billing?.recentLedger.length ? (
              <div className="space-y-3">
                {billing.recentLedger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{entry.entryType.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMinorUnits(entry.amountMinor, entry.currency)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No billing activity yet.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-md">
          <CardHeader><CardTitle>Payment settlements</CardTitle></CardHeader>
          <CardContent>
            {billing?.recentSettlements.length ? (
              <div className="space-y-3">
                {billing.recentSettlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{settlement.provider}</p>
                      <p className="text-xs text-muted-foreground">{settlement.status} · {formatDate(settlement.occurredAt)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMinorUnits(settlement.amountPaidMinor, settlement.currencyPaid)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
