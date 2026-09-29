import {
  disableDomainResellerConnection,
  saveDomainNameApiConnection,
} from '@/features/domains/server/reseller-admin-actions';
import type { listPlatformServiceConnections } from '@/features/platform-connections/server/service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

type Connection = Awaited<ReturnType<typeof listPlatformServiceConnections>>[number];

export function DomainResellerControlPanel({
  tenant,
  connections,
}: {
  tenant: string;
  connections: Connection[];
}) {
  const current = connections.find((item) => item.providerKey === 'domainnameapi' && item.status === 'active');

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-primary/20">
        <CardHeader>
          <CardTitle>System-wide domain reseller</CardTitle>
          <CardDescription>
            DomainNameAPI powers Mkety domain purchasing as a shared platform service. Enterprise AI, Deploy and future products consume this same service instead of storing their own registrar credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Provider</p>
            <p className="mt-2 font-semibold">DomainNameAPI</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Status</p>
            <p className="mt-2 font-semibold">{current ? 'Active' : 'Not configured'}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Environment</p>
            <p className="mt-2 font-semibold">{current?.mode?.toUpperCase() ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Configure / rotate DomainNameAPI</CardTitle>
          <CardDescription>
            Saving replaces the encrypted credentials immediately. No build or redeploy is required. Use the OT&amp;E Reseller ID + OT&amp;E API Key for sandbox testing; use the Live Reseller ID + Live API Key only for production.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveDomainNameApiConnection.bind(null, tenant)} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Environment
              <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={current?.mode ?? 'ote'} name="mode">
                <option value="ote">OT&amp;E / test</option>
                <option value="production">Production / billable</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Reseller ID (V2, numbers only)
              <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="resellerId" required />
            </label>
            <label className="text-sm font-medium">
              API Key
              <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiKey" required type="password" />
            </label>
            <label className="text-sm font-medium">
              Custom API base URL
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={current?.endpointUrl ?? ''} name="endpointUrl" placeholder="Leave blank for DomainNameAPI default" />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Nameservers
              <textarea className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={Array.isArray(current?.config?.nameServers) ? current.config.nameServers.join('\n') : ''} name="nameServers" placeholder={'ns1.example.com\nns2.example.com'} rows={3} />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input defaultChecked={current?.config?.whoisPrivacy !== false} name="whoisPrivacy" type="checkbox" />
              Enable WHOIS privacy where supported
            </label>
            <div className="md:col-span-2">
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save encrypted reseller connection
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {current ? (
        <Card className="rounded-2xl border-destructive/20">
          <CardHeader>
            <CardTitle>Disable reseller connection</CardTitle>
            <CardDescription>This stops new Mkety registrar operations without deleting historical domain records.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={disableDomainResellerConnection.bind(null, tenant, current.id)}>
              <button className="rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive">Disable DomainNameAPI</button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
