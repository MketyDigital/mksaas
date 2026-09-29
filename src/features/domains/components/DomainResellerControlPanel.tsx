import {
  disableCloudflareDomainRoutingConnection,
  disableDomainResellerConnection,
  saveCloudflareDomainRoutingConnection,
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
  const cloudflare = connections.find((item) => item.providerKey === 'cloudflare-saas' && item.status === 'active');

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
            Saving replaces the encrypted credentials immediately. No build or redeploy is required. Use the exact V2 Reseller ID shown in your DomainNameAPI account. Pair it with the Test Environment API Key for OT&amp;E, or the Live Environment API Key for production.
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
              Reseller ID (V2, exactly as issued)
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
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:col-span-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="font-semibold">Customer pricing</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mkety starts from DomainNameAPI&apos;s real provider price, then applies these editable markups to the customer sell price.
                </p>
              </div>
              <label className="text-sm font-medium">
                Registration markup %
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={Number(current?.config?.registrationMarkupPercent ?? 0)} min="0" max="1000" name="registrationMarkupPercent" step="0.01" type="number" />
              </label>
              <label className="text-sm font-medium">
                Renewal markup %
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={Number(current?.config?.renewalMarkupPercent ?? 0)} min="0" max="1000" name="renewalMarkupPercent" step="0.01" type="number" />
              </label>
              <label className="text-sm font-medium">
                Registration fixed add-on
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={Number(current?.config?.registrationFixedMarkupMinor ?? 0) / 100} min="0" name="registrationFixedMarkup" step="0.01" type="number" />
              </label>
              <label className="text-sm font-medium">
                Renewal fixed add-on
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={Number(current?.config?.renewalFixedMarkupMinor ?? 0) / 100} min="0" name="renewalFixedMarkup" step="0.01" type="number" />
              </label>
            </div>
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


      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Cloudflare domains, DNS &amp; custom hostnames</CardTitle>
          <CardDescription>
            Editable production routing for Cloudflare for SaaS and managed *.mkety.app DNS. Existing environment values remain a bootstrap fallback until this connection is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveCloudflareDomainRoutingConnection.bind(null, tenant)} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Cloudflare API token
              <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiToken" placeholder={cloudflare ? 'Leave blank to keep the currently encrypted token' : 'Required for first setup'} type="password" />
            </label>
            <label className="text-sm font-medium">
              Cloudflare for SaaS zone ID
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.saasZoneId ?? '')} name="saasZoneId" required />
            </label>
            <label className="text-sm font-medium">
              mkety.app DNS zone ID
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.appZoneId ?? '')} name="appZoneId" required />
            </label>
            <label className="text-sm font-medium">
              SaaS CNAME target
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.cnameTarget ?? '')} name="cnameTarget" placeholder="origin.example.com" required />
            </label>
            <label className="text-sm font-medium">
              Minimum TLS
              <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.minTlsVersion ?? '1.2')} name="minTlsVersion">
                <option value="1.2">TLS 1.2</option>
                <option value="1.3">TLS 1.3</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
              <input defaultChecked={cloudflare?.config?.managedDnsProxied === true} name="managedDnsProxied" type="checkbox" />
              Proxy managed mkety.app CNAME records through Cloudflare
            </label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save Cloudflare routing configuration
              </button>
              {cloudflare ? (
                <button
                  className="rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive"
                  formAction={disableCloudflareDomainRoutingConnection.bind(null, tenant, cloudflare.id)}
                >
                  Disable Cloudflare routing connection
                </button>
              ) : null}
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
