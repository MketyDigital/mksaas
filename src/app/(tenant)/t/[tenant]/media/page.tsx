import { ExternalLink, Image as ImageIcon, Link2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getMediaTenantLink } from '@/features/media/server/links';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function MediaConnectorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  const link = await getMediaTenantLink(tenant.id);
  const connected = link?.status === 'linked';

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div>
        <Link className="text-sm text-muted-foreground" href={`/t/${tenantSlug}`}>← Workspace</Link>
        <div className="mt-2 flex items-center gap-3">
          <ImageIcon className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Mkety Media</h1>
        </div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Connect this Mkety workspace to the existing Mkety Media product without moving Media runtime, billing or customer data into the Platform.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{connected ? 'Media is connected' : 'Media connection'}</CardTitle>
              <CardDescription>
                {connected
                  ? 'This workspace is linked to an existing Mkety Media workspace.'
                  : link?.status === 'suspended'
                    ? 'The Media link is suspended. Media access remains governed by the standalone Media product.'
                    : 'No verified Media workspace link is active yet.'}
              </CardDescription>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">
              {link?.status ?? 'not linked'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {link ? (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Media workspace reference</p>
              <p className="mt-2 font-mono">{link.externalWorkspaceRef}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Linked {link.linkedAt.toLocaleString()}. This reference contains no Media credentials or payment secrets.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              href="https://media.mkety.com"
            >
              Open Mkety Media <ExternalLink className="h-4 w-4" />
            </a>
            <Link className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold" href={`/t/${tenantSlug}/billing`}>
              Plan & billing
            </Link>
          </div>

          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                Mkety Media remains a standalone product today. Its own subscription and runtime stay authoritative. This Platform link is a safe connection record and product entry point; cross-product SSO or automatic entitlement sync will only be enabled after the Media runtime exposes a verified integration endpoint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
