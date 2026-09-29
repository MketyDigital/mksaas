import { Globe2 } from 'lucide-react';

import { listDomains } from '@/features/admin/services/domains-service';
import { listManagedDomains } from '@/features/domains/server/managed-domain-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import { DomainsClient } from './DomainsClient';
import { ManagedDomainsClient } from './ManagedDomainsClient';

interface DomainsPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function DomainsPage({ params }: DomainsPageProps) {
  const { tenant } = await params;
  const [result, managedDomains] = await Promise.all([
    listDomains(tenant),
    listManagedDomains(tenant).catch(() => []),
  ]);
  const domains = result.success && Array.isArray(result.data) ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Mkety Domains</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your own domain to this workspace through Mkety-managed routing and HTTPS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered with Mkety</CardTitle>
          <CardDescription>
            Domains purchased through Mkety appear here with renewal and authoritative DNS status. DNS records stay live with Mkety’s managed DNS provider rather than being duplicated into the app database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagedDomainsClient tenantSlug={tenant} initialDomains={managedDomains} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom domain connections</CardTitle>
          <CardDescription>
            Add a hostname, follow the Mkety DNS target shown after creation, then verify when DNS has propagated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DomainsClient tenantSlug={tenant} initialDomains={domains} />
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Mkety Domains | Admin',
  description: 'Manage custom domains for your workspace',
};
