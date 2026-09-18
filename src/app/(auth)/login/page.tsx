import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/features/auth/components/LoginForm';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Sign In | Mkety',
  description: 'Sign in to your Mkety workspace',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function LoginPage({ searchParams: _searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    const userRoles = (session.user.roles ?? {}) as Record<string, TenantRole>;
    const tenantSlugs = Object.keys(userRoles);
    if (tenantSlugs.length === 1) redirect(`/t/${tenantSlugs[0]}`);
    if (tenantSlugs.length > 1) redirect('/select-tenant');
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
        <LoginForm />
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to Mkety?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
