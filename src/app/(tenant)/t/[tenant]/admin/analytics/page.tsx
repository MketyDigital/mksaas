import { Activity, BriefcaseBusiness, ShieldCheck, Users } from 'lucide-react';

import { getAdminStats } from '@/features/admin/services/admin-stats-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requirePermission(tenant, 'admin:dashboard');
  const stats = await getAdminStats(tenant);

  const cards = [
    { label: 'Active people', value: stats.persons, icon: Users, description: 'People currently represented in this tenant.' },
    { label: 'Roles', value: stats.roles, icon: ShieldCheck, description: 'System and tenant roles currently available.' },
    { label: 'Integration jobs', value: stats.integrationJobs, icon: BriefcaseBusiness, description: 'Recorded integration processing jobs.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Admin Analytics</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Operational tenant summary. Product usage and commercial analytics remain in their dedicated workspaces.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, description }) => (
          <Card className="rounded-2xl" key={label}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{label}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
