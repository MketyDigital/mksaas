import { redirect } from 'next/navigation';

import { getTenantSettings } from '@/features/admin/services/settings-service';
import { hasEnterpriseAiAccess, hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import { listEnterpriseAiSolutionInstances } from '@/features/ai-runtime/server/business-solutions';
import { resolveEnterpriseAiBrand } from '@/features/ai-runtime/server/white-label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiCustomerAppPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  const [enterprise, whiteLabel, settings, instances] = await Promise.all([
    hasEnterpriseAiAccess(tenant.id),
    hasEnterpriseAiWhiteLabelAccess(tenant.id),
    getTenantSettings(tenantSlug),
    listEnterpriseAiSolutionInstances(tenant.id),
  ]);
  if (!enterprise) redirect(`/t/${tenantSlug}`);

  const resolved = resolveEnterpriseAiBrand(settings, tenant.name);
  const brand = whiteLabel && resolved.enabled
    ? resolved
    : { ...resolved, enabled: false, brandName: tenant.name, productName: 'AI Assistant', hideMketyBranding: false };

  return (
    <main
      className="min-h-screen px-5 py-8 sm:px-8"
      style={{
        background: `linear-gradient(180deg, ${brand.primaryColor}12 0%, transparent 38%)`,
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3">
            {brand.logoUrl ? (
              <img alt={brand.brandName} className="h-10 max-w-[220px] object-contain" src={brand.logoUrl} />
            ) : (
              <div className="text-xl font-bold" style={{ color: brand.primaryColor }}>{brand.brandName}</div>
            )}
            <span className="text-sm text-muted-foreground">{brand.productName}</span>
          </div>
          {brand.supportUrl ? (
            <a className="text-sm font-semibold" href={brand.supportUrl}>Support</a>
          ) : brand.supportEmail ? (
            <a className="text-sm font-semibold" href={`mailto:${brand.supportEmail}`}>Support</a>
          ) : null}
        </header>

        <section className="py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: brand.primaryColor }}>
            {brand.productName}
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">
            How can we help you today?
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Choose an available AI solution. Your organization controls the approved knowledge, permissions and connected channels behind each experience.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {instances.filter((instance) => instance.status !== 'disabled').map((instance) => (
            <Card className="rounded-2xl" key={instance.id}>
              <CardHeader>
                <CardTitle>{instance.name}</CardTitle>
                <CardDescription>
                  {instance.status === 'draft' ? 'Being prepared by your organization' : 'Available'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
              </CardContent>
            </Card>
          ))}
          {!instances.length ? (
            <Card className="rounded-2xl md:col-span-2">
              <CardHeader>
                <CardTitle>Your AI experience is being prepared</CardTitle>
                <CardDescription>Your organization has not published a customer AI solution yet.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}
        </section>

        <footer className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-xs text-muted-foreground">
          {brand.privacyUrl ? <a href={brand.privacyUrl}>Privacy</a> : null}
          {brand.termsUrl ? <a href={brand.termsUrl}>Terms</a> : null}
          {brand.legalName ? <span>© {new Date().getUTCFullYear()} {brand.legalName}</span> : null}
          {!brand.hideMketyBranding ? <span>Powered by Mkety</span> : null}
        </footer>
      </div>
    </main>
  );
}
