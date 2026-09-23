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
  searchParams: Promise<{ email?: string; plan?: string; term?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const planKey = query.plan && isSelfServiceBillingPlanKey(query.plan) ? query.plan : null;
  const termKey = query.term && isSelfServiceBillingTermKey(query.term) ? query.term : null;
  const planQuery = planKey ? `plan=${encodeURIComponent(planKey)}${termKey ? `&term=${encodeURIComponent(termKey)}` : ''}` : '';
  const selectTenantUrl = planKey ? `/select-tenant?${planQuery}` : '/select-tenant';

  const session = await auth();

  if (session?.user) {
    const userRoles = (session.user.roles ?? {}) as Record<string, TenantRole>;
    const tenantSlugs = Object.keys(userRoles);
    if (tenantSlugs.length === 1) {
      redirect(
        planKey
          ? `/t/${tenantSlugs[0]}/billing/checkout?${planQuery}`
          : `/t/${tenantSlugs[0]}`,
      );
    }
    if (tenantSlugs.length > 1) redirect(selectTenantUrl);
  }

  redirect(`/api/auth/login?returnTo=${encodeURIComponent(selectTenantUrl)}&intent=signin`);
}
