import { Building2, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { auth } from '@/shared/lib/auth';
import { getAllRoles } from '@/shared/lib/rbac';

export const metadata = {
  title: 'Select Organization | Mkety',
  description: 'Choose an organization to access',
};

export const dynamic = 'force-dynamic';

export default async function SelectTenantPage() {
  const session = await auth();

  if (!session?.user) redirect('/login');

  const userRoles = await getAllRoles();
  const tenantSlugs = Object.keys(userRoles);

  if (tenantSlugs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-500/5 p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 mb-4">
            <Building2 className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">No Organizations Yet</h1>
          <p className="text-muted-foreground mb-6">
            You&apos;re signed in as <strong>{session.user.email}</strong>. Create your first workspace or ask an organization admin to invite you.
          </p>
          <Link href="/create-workspace" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" />
            Create workspace
          </Link>
        </div>
      </div>
    );
  }

  if (tenantSlugs.length === 1) redirect(`/t/${tenantSlugs[0]}`);

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary shadow-lg mb-4">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold brand-gradient-text">Select Organization</h1>
          <p className="text-muted-foreground mt-2">Choose which workspace to access</p>
        </div>

        <Card className="border shadow-xl bg-card">
          <CardHeader className="text-center">
            <CardTitle>Your Organizations</CardTitle>
            <CardDescription>Signed in as {session.user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenantSlugs.map((slug) => {
              const role = userRoles[slug];
              return (
                <Link key={slug} href={`/t/${slug}`} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:border-primary/50 hover:bg-accent/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">{slug}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
                </Link>
              );
            })}
            <Link href="/create-workspace" className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium hover:bg-muted/40">
              <Plus className="h-4 w-4" /> Create another workspace
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
