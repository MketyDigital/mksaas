import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getTenantSettings } from '@/features/admin/services/settings-service';
import { hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import {
  connectEnterpriseAiHostname,
  provisionEnterpriseAiManagedHostname,
  refreshEnterpriseAiHostname,
  saveEnterpriseAiWhiteLabel,
} from '@/features/ai-runtime/server/enterprise-admin-actions';
import { resolveEnterpriseAiBrand } from '@/features/ai-runtime/server/white-label';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/shared/components/ui';
import { db } from '@/shared/db/cloudflare';
import { customDomains } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

function metadata(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { purpose?: string; cnameTarget?: string; sslStatus?: string | null; managed?: boolean };
  } catch {
    return null;
  }
}

export default async function EnterpriseAiBrandingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  await requirePermission(tenantSlug, 'ai:enterprise:admin');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  const [settings, whiteLabelAccess, domains] = await Promise.all([
    getTenantSettings(tenantSlug),
    hasEnterpriseAiWhiteLabelAccess(tenant.id),
    db.select().from(customDomains).where(eq(customDomains.tenantId, tenant.id)),
  ]);
  const brand = resolveEnterpriseAiBrand(settings, tenant.name);
  const aiDomains = domains
    .map((domain) => ({ domain, meta: metadata(domain.providerVerified) }))
    .filter((item) => item.domain.provider === 'cloudflare-for-saas' && item.meta?.purpose === 'enterprise-ai');

  if (!whiteLabelAccess) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card><CardHeader><CardTitle>White-label access is not enabled</CardTitle><CardDescription>This control is available only when the Enterprise AI white-label entitlement is active.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div>
        <Link href={`/t/${tenantSlug}/enterprise-ai`} className="text-sm text-muted-foreground">← Enterprise AI</Link>
        <h1 className="mt-2 text-3xl font-bold">Brand & domain</h1>
        <p className="mt-2 text-muted-foreground">Replace Mkety-facing product branding for your customer AI experience and connect your own hostname.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Full white-label branding</CardTitle><CardDescription>Your logo, name, colors, support and legal links are used on entitled Enterprise AI customer surfaces.</CardDescription></CardHeader>
        <CardContent>
          <form action={saveEnterpriseAiWhiteLabel.bind(null, tenantSlug)} className="grid gap-5 md:grid-cols-2">
            <div><Label htmlFor="brandName">Brand name</Label><Input id="brandName" name="brandName" defaultValue={brand.brandName} className="mt-2" /></div>
            <div><Label htmlFor="productName">Product name</Label><Input id="productName" name="productName" defaultValue={brand.productName} className="mt-2" /></div>
            <div><Label htmlFor="logoUrl">Logo URL</Label><Input id="logoUrl" name="logoUrl" defaultValue={brand.logoUrl ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="faviconUrl">Favicon URL</Label><Input id="faviconUrl" name="faviconUrl" defaultValue={brand.faviconUrl ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="primaryColor">Primary color</Label><Input id="primaryColor" name="primaryColor" defaultValue={brand.primaryColor} className="mt-2" /></div>
            <div><Label htmlFor="secondaryColor">Secondary color</Label><Input id="secondaryColor" name="secondaryColor" defaultValue={brand.secondaryColor} className="mt-2" /></div>
            <div><Label htmlFor="accentColor">Accent color</Label><Input id="accentColor" name="accentColor" defaultValue={brand.accentColor} className="mt-2" /></div>
            <div><Label htmlFor="legalName">Legal name</Label><Input id="legalName" name="legalName" defaultValue={brand.legalName ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="supportEmail">Support email</Label><Input id="supportEmail" name="supportEmail" defaultValue={brand.supportEmail ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="supportUrl">Support URL</Label><Input id="supportUrl" name="supportUrl" defaultValue={brand.supportUrl ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="privacyUrl">Privacy URL</Label><Input id="privacyUrl" name="privacyUrl" defaultValue={brand.privacyUrl ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="termsUrl">Terms URL</Label><Input id="termsUrl" name="termsUrl" defaultValue={brand.termsUrl ?? ''} className="mt-2" /></div>
            <div><Label htmlFor="loginHeading">Login heading</Label><Input id="loginHeading" name="loginHeading" defaultValue={brand.loginHeading} className="mt-2" /></div>
            <div><Label htmlFor="loginSubheading">Login subheading</Label><Input id="loginSubheading" name="loginSubheading" defaultValue={brand.loginSubheading ?? ''} className="mt-2" /></div>
            <input type="hidden" name="hideMketyBranding" value="on" />
            <div className="md:col-span-2"><Button type="submit">Save white-label brand</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Your web address</CardTitle>
          <CardDescription>Activate a managed <strong>*.mkety.app</strong> address, or connect your own domain with one CNAME record. Mkety handles TLS and app routing through Cloudflare for SaaS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border p-4">
            <p className="font-semibold">Managed Mkety address</p>
            <p className="mt-1 text-sm text-muted-foreground">Mkety provisions DNS and TLS for this address; you do not add any DNS record.</p>
            <form action={provisionEnterpriseAiManagedHostname.bind(null, tenantSlug)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border bg-background">
                <Input name="managedSubdomain" defaultValue={brand.managedSubdomain ?? tenant.slug} className="border-0 focus-visible:ring-0" />
                <span className="pr-3 text-sm text-muted-foreground">.mkety.app</span>
              </div>
              <Button type="submit">Activate address</Button>
            </form>
          </div>

          <div className="border-t pt-5">
            <p className="font-semibold">Your own domain</p>
            <p className="mt-1 text-sm text-muted-foreground">Enter a hostname such as ai.yourcompany.com. You will add one CNAME record after Mkety creates the hostname.</p>
          </div>
          <form action={connectEnterpriseAiHostname.bind(null, tenantSlug)} className="flex flex-col gap-3 sm:flex-row">
            <Input name="hostname" placeholder="ai.yourcompany.com" className="sm:max-w-md" />
            <Button type="submit">Connect domain</Button>
          </form>

          {aiDomains.map(({ domain, meta }) => (
            <div key={domain.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">{domain.hostname}</p><p className="text-sm text-muted-foreground">Status: {domain.status} · SSL: {meta?.sslStatus ?? 'pending'}</p></div>
                {domain.status !== 'verified' ? (
                  <form action={refreshEnterpriseAiHostname.bind(null, tenantSlug)}>
                    <input type="hidden" name="hostname" value={domain.hostname} />
                    <Button variant="outline" type="submit">Check connection</Button>
                  </form>
                ) : <span className="text-sm font-semibold text-emerald-600">Ready</span>}
              </div>
              {meta?.managed ? (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">Mkety-managed address</p>
                  <p className="mt-1 text-muted-foreground">DNS, certificate issuance and routing are managed automatically by Mkety.</p>
                </div>
              ) : meta?.cnameTarget ? (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">Add one DNS record</p>
                  <p className="mt-1 font-mono break-all">CNAME {domain.hostname} → {meta.cnameTarget}</p>
                  <p className="mt-2 text-muted-foreground">That is the only customer DNS step. Mkety provisions the certificate and routes the hostname after verification.</p>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Need a new domain?</CardTitle><CardDescription>Domain purchase uses Mkety's server-side reseller adapter. The customer can search, buy and then attach it without handling registrar or Cloudflare credentials.</CardDescription></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">The provider-neutral reseller contract is ready; the configured registrar account can be bound to it without changing this Enterprise AI UI.</p></CardContent>
      </Card>
    </div>
  );
}
