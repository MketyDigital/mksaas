import { ArrowLeft, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  listManagedDnsRecords,
  listManagedDomains,
} from '@/features/domains/server/managed-domain-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import { DnsRecordsClient } from './DnsRecordsClient';

interface PageProps {
  params: Promise<{ tenant: string; domainId: string }>;
}

export default async function ManagedDomainDnsPage({ params }: PageProps) {
  const { tenant, domainId } = await params;
  const domains = await listManagedDomains(tenant);
  const domain = domains.find((item) => item.id === domainId);
  if (!domain) notFound();

  const records = domain.dnsZoneId
    ? await listManagedDnsRecords(tenant, domain.id).catch(() => [])
    : [];

  return (
    <div className="space-y-6">
      <Link
        href={`/t/${tenant}/admin/settings/domains`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Mkety Domains
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{domain.domain}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage authoritative DNS records for this Mkety-registered domain.
        </p>
      </div>

      <Card className="rounded-2xl border-primary/20">
        <CardHeader>
          <CardTitle>Domain status</CardTitle>
          <CardDescription>
            Registrar and DNS infrastructure are managed by Mkety. Provider details remain behind the platform boundary.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase text-muted-foreground">Registration</p>
            <p className="mt-1 font-semibold capitalize">{domain.status}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase text-muted-foreground">DNS</p>
            <p className="mt-1 font-semibold capitalize">{domain.dnsStatus}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase text-muted-foreground">Renewal</p>
            <p className="mt-1 font-semibold">{domain.autoRenew ? 'Automatic' : 'Manual'}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs uppercase text-muted-foreground">Expiry</p>
            <p className="mt-1 font-semibold">
              {domain.expiresAt ? new Date(domain.expiresAt).toLocaleDateString() : 'Pending'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Mkety DNS records</CardTitle>
          <CardDescription>
            Changes apply to the live authoritative zone. System-managed nameserver and SOA records are protected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domain.dnsZoneId ? (
            <DnsRecordsClient
              tenantSlug={tenant}
              domainId={domain.id}
              domain={domain.domain}
              initialRecords={records}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Mkety DNS is not provisioned yet. Return to the Domains page and choose Set up Mkety DNS.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Mkety DNS | Admin',
  description: 'Manage DNS records for a Mkety domain',
};
