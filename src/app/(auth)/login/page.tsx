import { Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/features/auth/components/LoginForm';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const metadata = {
  title: 'Sign In | Mkety',
  description: 'Sign in to your Mkety workspace',
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg mb-4 animate-pulse">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold brand-gradient-text mb-2">Welcome to Mkety</h1>
          <p className="text-muted-foreground">Sign in to your workspace</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
