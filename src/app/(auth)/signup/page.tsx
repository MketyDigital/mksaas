import { redirect } from 'next/navigation';

import { isSelfServiceBillingPlanKey, isSelfServiceBillingTermKey } from '@/features/billing/catalog/self-service-plans';
import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Create Account | Mkety',
  description: 'Create your Mkety account and start your first workspace.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface SignupPageProps {
  searchParams: Promise<{ plan?: string; term?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const query = await searchParams;
  const planKey = query.plan && isSelfServiceBillingPlanKey(query.plan) ? query.plan : null;
  const termKey = query.term && isSelfServiceBillingTermKey(query.term) ? query.term : null;
  const planQuery = planKey
    ? `plan=${encodeURIComponent(planKey)}${termKey ? `&term=${encodeURIComponent(termKey)}` : ''}`
    : '';
  const selectTenantUrl = planKey ? `/select-tenant?${planQuery}` : '/select-tenant';

  const session = await auth();
  if (session?.user) redirect(selectTenantUrl);

  redirect(
    `/api/auth/login?returnTo=${encodeURIComponent(selectTenantUrl)}&intent=signup`,
  );
}
