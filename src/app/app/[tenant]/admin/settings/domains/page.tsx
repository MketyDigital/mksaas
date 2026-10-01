import { Globe2 } from 'lucide-react';

import { listDomains } from '@/features/admin/services/domains-service';
import { listManagedDomains } from '@/features/domains/server/managed-domain-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import { DomainsClient } from './DomainsClient';
import { DomainSearchClient } from './DomainSearchClient';
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
          Register new domains, manage Mkety DNS, renew domains and connect existing hostnames from one place.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register a new domain</CardTitle>
          <CardDescription>
            Search live availability and see the current Mkety registration and renewal price before checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DomainSearchClient tenantSlug={tenant} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered with Mkety</CardTitle>
          <CardDescription>
            Domains purchased through Mkety appear here with renewal and authoritative DNS status. DNS records stay live in Mkety DNS rather than being duplicated into the app database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagedDomainsClient tenantSlug={tenant} initialDomains={managedDomains} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect an existing domain</CardTitle>
          <CardDescription>
            Already own a domain elsewhere? Connect its hostname to supported Mkety products without moving the registration.
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
  description: 'Register domains, manage Mkety DNS, renew domains and connect existing hostnames',
};
