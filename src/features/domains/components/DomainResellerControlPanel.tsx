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
          <CardTitle>Mkety Domains &amp; DNS</CardTitle>
          <CardDescription>
            One operations surface for domain registration, customer pricing, nameservers, DNS and custom hostnames. Provider credentials stay protected behind Mkety.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Registration</p>
            <p className="mt-2 font-semibold">{current ? 'Connected' : 'Not configured'}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">DNS &amp; hostnames</p>
            <p className="mt-2 font-semibold">{cloudflare ? 'Connected' : 'Not configured'}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Environment</p>
            <p className="mt-2 font-semibold">{current?.mode?.toUpperCase() ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Domain registration &amp; pricing</CardTitle>
          <CardDescription>
            Update Mkety’s registrar connection, default nameservers and customer pricing policy without rebuilding the application. Provider credentials remain encrypted.
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
              Registrar Reseller ID
              <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="resellerId" placeholder={current ? 'Leave blank to keep the current Reseller ID' : 'Required'} required={!current} />
            </label>
            <label className="text-sm font-medium">
              Registrar API key
              <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiKey" placeholder={current ? 'Leave blank to keep the encrypted key' : 'Required'} required={!current} type="password" />
            </label>
            <label className="text-sm font-medium">
              Custom API base URL
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={current?.endpointUrl ?? ''} name="endpointUrl" placeholder="Leave blank for DomainNameAPI default" />
            </label>
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:col-span-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="font-semibold">Customer pricing</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mkety starts from the live upstream registration/renewal price and applies these editable margins to the customer sell price.
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
                Save domain registration settings
              </button>
            </div>
          </form>
        </CardContent>
      </Card>


      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>DNS &amp; custom hostname infrastructure</CardTitle>
          <CardDescription>
            Configure the protected infrastructure Mkety uses for authoritative DNS, managed *.mkety.app records and customer custom-hostname validation. Environment values remain a recovery fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveCloudflareDomainRoutingConnection.bind(null, tenant)} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Cloudflare API token
              <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiToken" placeholder={cloudflare ? 'Leave blank to keep the currently encrypted token' : 'Required for first setup'} type="password" />
            </label>
            <label className="text-sm font-medium">
              Cloudflare account ID
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '')} name="accountId" required />
            </label>
            <label className="text-sm font-medium">
              Cloudflare for SaaS zone ID
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.saasZoneId ?? process.env.MKETY_SAAS_ZONE_ID ?? '')} name="saasZoneId" required />
            </label>
            <label className="text-sm font-medium">
              mkety.app DNS zone ID
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.appZoneId ?? process.env.MKETY_APP_ZONE_ID ?? '')} name="appZoneId" required />
            </label>
            <label className="text-sm font-medium">
              SaaS CNAME target
              <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={String(cloudflare?.config?.cnameTarget ?? process.env.MKETY_SAAS_CNAME_TARGET ?? '')} name="cnameTarget" placeholder="origin.example.com" required />
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
                Save DNS & hostname settings
              </button>
              {cloudflare ? (
                <button
                  className="rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive"
                  formAction={disableCloudflareDomainRoutingConnection.bind(null, tenant, cloudflare.id)}
                >
                  Disable DNS routing connection
                </button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {current ? (
        <Card className="rounded-2xl border-destructive/20">
          <CardHeader>
            <CardTitle>Disable domain registration</CardTitle>
            <CardDescription>This stops new Mkety registrar operations without deleting historical domain records.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={disableDomainResellerConnection.bind(null, tenant, current.id)}>
              <button className="rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive">Disable domain registration</button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
