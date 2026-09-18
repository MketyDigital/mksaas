import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/features/auth/components/LoginForm';
import { isSelfServiceBillingPlanKey } from '@/features/billing/catalog/self-service-plans';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Sign In | Mkety',
  description: 'Sign in to your Mkety workspace',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ email?: string; plan?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const planKey = query.plan && isSelfServiceBillingPlanKey(query.plan) ? query.plan : null;
  const selectTenantUrl = planKey ? `/select-tenant?plan=${encodeURIComponent(planKey)}` : '/select-tenant';

  const session = await auth();

  if (session?.user) {
    const userRoles = (session.user.roles ?? {}) as Record<string, TenantRole>;
    const tenantSlugs = Object.keys(userRoles);
    if (tenantSlugs.length === 1) {
      redirect(
        planKey
          ? `/t/${tenantSlugs[0]}/billing/checkout?plan=${encodeURIComponent(planKey)}`
          : `/t/${tenantSlugs[0]}`,
      );
    }
    if (tenantSlugs.length > 1) redirect(selectTenantUrl);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/mkety-logo.png" alt="Mkety" className="mx-auto mb-5 h-10 w-auto" />
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome to Mkety</h1>
          <p className="text-muted-foreground">Sign in to your workspace</p>
        </div>
        <LoginForm callbackUrl={selectTenantUrl} />
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to Mkety?{' '}
          <Link href={planKey ? `/signup?plan=${encodeURIComponent(planKey)}` : '/signup'} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
