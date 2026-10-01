import { redirect } from 'next/navigation';

import { isSelfServiceBillingPlanKey, isSelfServiceBillingTermKey } from '@/features/billing/catalog/self-service-plans';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Sign In | Mkety',
  description: 'Sign in to your Mkety workspace',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ plan?: string; term?: string; returnTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const planKey = query.plan && isSelfServiceBillingPlanKey(query.plan) ? query.plan : null;
  const safeReturnTo = query.returnTo && query.returnTo.startsWith('/') && !query.returnTo.startsWith('//') ? query.returnTo : null;
  const termKey = query.term && isSelfServiceBillingTermKey(query.term) ? query.term : null;
  const planQuery = planKey
    ? `plan=${encodeURIComponent(planKey)}${termKey ? `&term=${encodeURIComponent(termKey)}` : ''}`
    : '';
  const selectTenantUrl = safeReturnTo ?? (planKey ? `/select-tenant?${planQuery}` : '/select-tenant');

  const session = await auth();
  if (session?.user) {
    if (safeReturnTo) redirect(safeReturnTo);
    const userRoles = (session.user.roles ?? {}) as Record<string, TenantRole>;
    const tenantSlugs = Object.keys(userRoles);
    if (tenantSlugs.length === 1) {
      redirect(planKey ? `/app/${tenantSlugs[0]}/billing/checkout?${planQuery}` : `/app/${tenantSlugs[0]}`);
    }
    if (tenantSlugs.length > 1) redirect(selectTenantUrl);
  }

  redirect(
    `/api/auth/login?returnTo=${encodeURIComponent(selectTenantUrl)}&intent=signin`,
  );
}
