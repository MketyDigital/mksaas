import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getTenantEntitlementsForRequest } from '@/features/entitlements/server/resolver';
import { isPlatformControlTenant, isPlatformOperatorEmail } from '@/features/platform-content/server/authorization';
import { ThemeCSSInjector } from '@/shared/components/providers/theme-css-injector';
import { withRequestDatabase } from '@/shared/db/request';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';
import { parseTenantSettings } from '@/shared/lib/tenant-settings';
import { TenantProvider } from '@/shared/providers';

import { TenantLayoutClient } from './TenantLayoutClient';

export const dynamic = 'force-dynamic';

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}

async function renderTenantLayout({ children, params }: TenantLayoutProps) {
  const { tenant: tenantSlug } = await params;
  const [tenant, session] = await Promise.all([
    getTenantBySlug(tenantSlug),
    auth(),
  ]);

  if (!tenant) notFound();
  if (!session?.user) redirect('/login');

  // auth() refreshes the user's current tenant memberships from the database.
  // Keep navigation visibility cheap by reusing that request-cached session snapshot.
  if (!(tenant.slug in (session.user.roles ?? {}))) {
    redirect(`/select-tenant?error=unauthorized`);
  }

  const settings = parseTenantSettings(tenant.settings);
  const entitlements = await getTenantEntitlementsForRequest(tenant.id);
  const allowedEntitlements = new Set(
    entitlements.filter((item) => item.allowed).map((item) => item.entitlement),
  );
  const permissions = session.user.permissions?.[tenant.slug] ?? [];
  const hasMailAccess = allowedEntitlements.has('workspace.mail');
  const hasEnterpriseAiAccess = allowedEntitlements.has('workspace.ai.enterprise');
  const hasPlatformControlAccess = Boolean(
    session.user.email
    && isPlatformControlTenant(tenant.slug)
    && isPlatformOperatorEmail(session.user.email)
    && (permissions.includes('*') || permissions.includes('admin:dashboard'))
  );

  return (
    <TenantProvider
      value={{
        slug: tenant.slug,
        id: tenant.id,
        name: tenant.name,
        settings,
      }}
    >
      <ThemeCSSInjector />
      <TenantLayoutClient
        tenantSlug={tenant.slug}
        permissions={permissions}
        hasMailAccess={hasMailAccess}
        hasEnterpriseAiAccess={hasEnterpriseAiAccess}
        hasPlatformControlAccess={hasPlatformControlAccess}
        session={session}
      >
        {children}
      </TenantLayoutClient>
    </TenantProvider>
  );
}

export default async function TenantLayout(props: TenantLayoutProps) {
  return withRequestDatabase(() => renderTenantLayout(props));
}
