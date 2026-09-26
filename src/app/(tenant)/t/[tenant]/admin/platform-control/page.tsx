import { BadgeCheck, Cloud, CreditCard, Globe2, KeyRound, LayoutDashboard, Route, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';

import { getPublishedControlCenterModules } from '@/features/platform-app-experience/server/queries';
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
  cloud: Cloud,
  route: Route,
  'key-round': KeyRound,
  shield: Shield,
};

function readinessLabel(ready: boolean, active: string, inactive: string) {
  return ready ? active : inactive;
}

export default async function PlatformControlPage({ params }: PlatformControlPageProps) {
  const { tenant } = await params;
  await requirePlatformControlAccess(tenant);

  const modules = await getPublishedControlCenterModules();
  const paymentReadiness = {
    nowpayments: Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET),
    flutterwave: Boolean(
      process.env.FLUTTERWAVE_PUBLIC_KEY &&
      process.env.FLUTTERWAVE_STANDARD_SECRET_KEY &&
      process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH &&
      process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET
    ),
    kora: Boolean(process.env.KORA_PUBLIC_KEY && process.env.KORA_SECRET_KEY),
  };

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
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Link href={`/t/${tenant}/admin/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">NOWPayments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.nowpayments, 'Ready · embedded crypto checkout', 'Needs API + IPN secrets')}
            </p>
          </Link>
          <Link href={`/t/${tenant}/admin/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Flutterwave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.flutterwave, 'Ready · v3 Inline + shared broker', 'Needs Standard/Inline runtime configuration')}
            </p>
          </Link>
          <Link href={`/t/${tenant}/admin/platform-control/payments`} className="rounded-xl border bg-background p-4 transition hover:border-primary/50">
            <p className="font-semibold">Kora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readinessLabel(paymentReadiness.kora, 'Ready · embedded checkout', 'Deferred · hidden until configured')}
            </p>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href={`/t/${tenant}/admin/platform-control/enterprise-payments`}>
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
            <Link key={module.key} href={`/t/${tenant}${module.href}`}>
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
