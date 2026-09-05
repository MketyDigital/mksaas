import { BadgeCheck, Cloud, Globe2, KeyRound, LayoutDashboard, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getPublishedControlCenterModules } from '@/features/platform-app-experience/server/queries';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { hasPermission } from '@/shared/lib/permissions';

interface PlatformControlPageProps {
  params: Promise<{ tenant: string }>;
}

const iconMap = {
  globe: Globe2,
  'layout-dashboard': LayoutDashboard,
  'badge-check': BadgeCheck,
  wallet: Wallet,
  cloud: Cloud,
  'key-round': KeyRound,
  shield: Shield,
};

export default async function PlatformControlPage({ params }: PlatformControlPageProps) {
  const { tenant } = await params;
  const canAccess = await hasPermission(tenant, 'admin:dashboard');

  if (!canAccess) {
    redirect(`/t/${tenant}?error=unauthorized`);
  }

  const modules = await getPublishedControlCenterModules();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Mkety administration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Platform Control Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Central command surface for Mkety public content, app experience, plans, billing operations, deployments, identity, and security visibility. Each module keeps its own server-side permission and safety boundary.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Level {module.level}</span>
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
