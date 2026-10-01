import { redirect } from 'next/navigation';

import { getTenantSettings } from '@/features/admin/services/settings-service';
import { hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import { resolveEnterpriseAiBrand } from '@/features/ai-runtime/server/white-label';
import { TenantLoginForm } from '@/features/auth/components/TenantLoginForm';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface TenantLoginPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ email?: string; enterpriseAiHost?: string }>;
}

export async function generateMetadata({ params }: TenantLoginPageProps) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { title: 'Sign In', robots: { index: false, follow: false } };

  const settings = await getTenantSettings(tenantSlug);
  const brand = resolveEnterpriseAiBrand(settings, tenant.name);
  const canWhiteLabel = await hasEnterpriseAiWhiteLabelAccess(tenant.id);
  const titleBrand = canWhiteLabel && brand.enabled ? brand.brandName : tenant.name;

  return {
    title: `Sign In | ${titleBrand}`,
    description: `Sign in to access ${titleBrand}`,
    robots: { index: false, follow: false },
    ...(canWhiteLabel && brand.enabled && brand.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}),
  };
}

export default async function TenantLoginPage({ params, searchParams }: TenantLoginPageProps) {
  const { tenant: tenantSlug } = await params;
  const { email: emailParam, enterpriseAiHost } = await searchParams;
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/5 p-4">
        <div className="text-center"><h1 className="text-2xl font-bold">Workspace not found</h1></div>
      </div>
    );
  }

  const [settings, canWhiteLabel] = await Promise.all([
    getTenantSettings(tenantSlug),
    hasEnterpriseAiWhiteLabelAccess(tenant.id),
  ]);
  const resolvedBrand = resolveEnterpriseAiBrand(settings, tenant.name);
  const brand = canWhiteLabel && resolvedBrand.enabled
    ? resolvedBrand
    : { ...resolvedBrand, enabled: false, brandName: tenant.name, productName: 'Workspace', hideMketyBranding: false };

  const session = await auth();
  if (session?.user) {
    const userRoles = session.user.roles as Record<string, TenantRole> | undefined;
    const hasMembership = userRoles && tenantSlug in userRoles;
    if (hasMembership) {
      if (enterpriseAiHost) {
        const centralOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com';
        const handoff = new URL('/api/auth/product-handoff/start', centralOrigin);
        handoff.searchParams.set('product', 'ai');
        handoff.searchParams.set('targetHost', enterpriseAiHost);
        handoff.searchParams.set('returnTo', '/ai/app');
        redirect(handoff.toString());
      }
      redirect(`/app/${tenantSlug}`);
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.brandName} className="mx-auto mb-5 h-10 w-auto" /> : null}
          <h1 className="text-2xl font-bold mb-2">Access required</h1>
          <p className="text-muted-foreground">Contact your organization administrator for access to {brand.brandName}.</p>
        </div>
      </div>
    );
  }

  let handoffUrl: string | undefined;
  if (enterpriseAiHost) {
    const centralOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com';
    const handoff = new URL('/api/auth/product-handoff/start', centralOrigin);
    handoff.searchParams.set('product', 'ai');
    handoff.searchParams.set('targetHost', enterpriseAiHost);
    handoff.searchParams.set('returnTo', '/ai/app');
    handoffUrl = handoff.toString();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: `${brand.primaryColor}0D` }}
    >
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.brandName} className="mx-auto mb-5 h-12 max-w-[220px] object-contain" />
          ) : (
            <div className="mx-auto mb-5 text-2xl font-bold" style={{ color: brand.primaryColor }}>{brand.brandName}</div>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{brand.loginHeading}</h1>
          <p className="text-muted-foreground mt-2">{brand.loginSubheading ?? `Access ${brand.productName}`}</p>
        </div>
        <TenantLoginForm
          tenantSlug={tenantSlug}
          tenantName={brand.brandName}
          initialEmail={emailParam ?? ''}
          authLabel="your organization account"
          handoffUrl={handoffUrl}
        />
        {!brand.hideMketyBranding ? <p className="mt-5 text-center text-xs text-muted-foreground">Secured by Mkety</p> : null}
      </div>
    </div>
  );
}
