import { BadgeCheck, Cloud, CreditCard, Globe2, KeyRound, LayoutDashboard, Mail, Route, Shield, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';

import { getEnabledMketyFlutterwaveCurrencies } from '@/features/payments/flutterwave-standard';
import { getMketyPaymentProviderStatuses } from '@/features/payments/provider-availability';
import { getMketyPaymentSettings } from '@/features/payments/settings';
import { getPublishedControlCenterModules } from '@/features/platform-app-experience/server/queries';
import { listPlatformServiceConnections } from '@/features/platform-connections/server/service';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PlatformControlPageProps {
  params: Promise<{ tenant: string }>;
}

const iconMap = {
  globe: Globe2,
  'layout-dashboard': LayoutDashboard,
  'badge-check': BadgeCheck,
  wallet: Wallet,
  'credit-card': CreditCard,
  mail: Mail,
  cloud: Cloud,
  route: Route,
  'key-round': KeyRound,
  shield: Shield,
  sparkles: Sparkles,
};

function readinessLabel(ready: boolean, active: string, inactive: string) {
  return ready ? active : inactive;
}

export default async function PlatformControlPage({ params }: PlatformControlPageProps) {
  const { tenant } = await params;
  await requirePlatformControlAccess(tenant);

  const [modules, domainConnections, paymentSettings] = await Promise.all([
    getPublishedControlCenterModules(),
    listPlatformServiceConnections('domains').catch(() => []),
    getMketyPaymentSettings().catch(() => null),
  ]);
  const domainRegistrarReady = domainConnections.some(
    (item) => item.providerKey === 'domainnameapi' && item.status === 'active',
  );
  const domainDnsReady = domainConnections.some(
    (item) => item.providerKey === 'cloudflare-saas' && item.status === 'active',
  );
  const paymentReadiness = Object.fromEntries(
    getMketyPaymentProviderStatuses({
      nowpayments: {
        apiKey: process.env.NOWPAYMENTS_API_KEY,
        ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
      },
      flutterwave: {
        brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET,
        collectionCurrencies: getEnabledMketyFlutterwaveCurrencies(paymentSettings?.flutterwave.fxRates),
        hasConfiguredCurrencyQuote: Object.keys(paymentSettings?.flutterwave.fxRates ?? {}).length > 0,
      },
      kora: { publicKey: process.env.KORA_PUBLIC_KEY, secretKey: process.env.KORA_SECRET_KEY },
    }).map(({ provider, ready }) => [provider, ready]),
  ) as Record<'nowpayments' | 'flutterwave' | 'kora', boolean>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Mkety Ops</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Platform Control Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Central command surface for Mkety public content, app experience, plans, billing operations, deployments,
          identity, and security visibility. Each module keeps its own server-side permission and safety boundary.
        </p>
      </div>

      <Card className="rounded-2xl border-primary/20 bg-primary/[0.025]">
        <CardHeader>
          <CardTitle>Operations overview</CardTitle>
          <CardDescription>
            Runtime readiness is shown without exposing provider secrets. Business payment settings remain editable in Payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Link href={`/ops/${tenant}/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">NOWPayments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.nowpayments, 'Ready · embedded crypto checkout', 'Needs API + IPN secrets')}
            </p>
          </Link>
          <Link href={`/ops/${tenant}/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Flutterwave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.flutterwave, 'Ready · v3 Inline + priced currency', 'Needs central broker and saved currency rate')}
            </p>
          </Link>
          <Link href={`/ops/${tenant}/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Kora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.kora, 'Ready · embedded checkout', 'Deferred · hidden until configured')}
            </p>
          </Link>
          <Link href={`/ops/${tenant}/platform-control/domains-routing`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Mkety Domains</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(domainRegistrarReady, 'Ready · registration and pricing connected', 'Needs registrar connection')}
            </p>
          </Link>
          <Link href={`/ops/${tenant}/platform-control/domains-routing`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Mkety DNS</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(domainDnsReady, 'Ready · DNS and custom hostnames connected', 'Needs DNS routing connection')}
            </p>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href={`/ops/${tenant}/platform-control/enterprise-payments`}>
          <Card className="h-full rounded-2xl border-primary/25 bg-primary/[0.03] transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg">
            <CardHeader>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Enterprise
                </span>
              </div>
              <CardTitle>Enterprise Payments</CardTitle>
              <CardDescription>
                Create exact-amount customer payment links for agreed quotes, deposits, milestones, and balances.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {modules.map((module) => {
          const Icon = iconMap[module.iconKey as keyof typeof iconMap] ?? Shield;
          return (
            <Link key={module.key} href={`/ops/${tenant}${module.href.replace("/admin", "")}`}>
              <Card className="h-full rounded-2xl border-border/60 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      Level {module.level}
                    </span>
                  </div>
                  <CardTitle>{module.label}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
