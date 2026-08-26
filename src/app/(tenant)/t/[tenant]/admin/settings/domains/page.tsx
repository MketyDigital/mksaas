import { Globe2 } from 'lucide-react';

import { listDomains } from '@/features/admin/services/domains-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import { DomainsClient } from './DomainsClient';

interface DomainsPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function DomainsPage({ params }: DomainsPageProps) {
  const { tenant } = await params;
  const result = await listDomains(tenant);
  const domains = result.success && Array.isArray(result.data) ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Custom Domains</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach a custom hostname to this workspace. Vercel integration is optional during development.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Domain management</CardTitle>
          <CardDescription>
            Add your domain now. When Vercel credentials are configured, the same screen can register and verify it automatically.
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
  title: 'Custom Domains | Admin',
  description: 'Manage custom domains for your workspace',
};
