import { Mail } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Open Mkety Mail',
  description: 'Choose an entitled Mkety Mail workspace.',
  robots: { index: false, follow: false },
};

export default async function MailAppEntryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?returnTo=%2Fmail%2Fapp');

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const tenantSlugs = Object.keys(roles);
  const entitled: Array<{ slug: string; name: string }> = [];

  for (const slug of tenantSlugs) {
    const tenant = await getTenantBySlug(slug);
    if (!tenant) continue;
    const allowed = await hasEntitlement({ tenantId: tenant.id, entitlement: 'workspace.mail' });
    if (allowed) entitled.push({ slug, name: tenant.name });
  }

  if (entitled.length === 1) redirect(`/t/${entitled[0].slug}/mail`);

  if (!entitled.length) {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-14">
        <div className="mx-auto max-w-xl">
          <Card className="rounded-3xl">
            <CardHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle>No active Mkety Mail workspace yet</CardTitle>
              <CardDescription>
                Subscribe to a Mail plan or add Mail to one of your existing Mkety workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="https://mkety.com/mail" className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">
                View Mail plans
              </Link>
              <Link href="/select-tenant?plan=mail-starter" className="rounded-xl border px-4 py-2 font-semibold">
                Add Mail to a workspace
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-14">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mkety Mail</p>
          <h1 className="mt-2 text-3xl font-bold">Choose a Mail workspace</h1>
          <p className="mt-2 text-muted-foreground">You have Mail access in more than one Mkety workspace.</p>
        </div>
        <div className="grid gap-3">
          {entitled.map((tenant) => (
            <Link key={tenant.slug} href={`/t/${tenant.slug}/mail`}>
              <Card className="rounded-2xl transition hover:border-primary/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle>{tenant.name}</CardTitle>
                  <CardDescription>{tenant.slug}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
