import { Mail } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Open Mkety Mail',
  description: 'Choose an entitled Mkety Mail workspace.',
  robots: { index: false, follow: false },
};

async function renderMailWorkspaceChooser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?returnTo=%2Fmail%2Fapp');

  const memberships = await db.query.tenantMemberships.findMany({
    where: (table, { eq }) => eq(table.userId, session.user.id),
    with: { tenant: { columns: { id: true, slug: true, name: true } } },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  const entitlementDecisions = await Promise.all(
    memberships.map(async (membership) => ({
      membership,
      allowed: await hasEntitlement({
        tenantId: membership.tenant.id,
        entitlement: 'workspace.mail',
      }),
    })),
  );
  const entitled = entitlementDecisions
    .filter((item) => item.allowed)
    .map(({ membership }) => ({
      slug: membership.tenant.slug,
      name: membership.tenant.name,
    }));

  if (entitled.length === 1) redirect(`/app/${entitled[0].slug}/mail`);

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
              <Link href="https://app.mkety.com/select-tenant?plan=mail-starter" className="rounded-xl border px-4 py-2 font-semibold">
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
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mkety Mail</h1>
            <p className="text-sm text-muted-foreground">Choose an entitled Mail workspace.</p>
          </div>
        </div>
        <div className="grid gap-3">
          {entitled.map((tenant) => (
            <Link key={tenant.slug} href={`/app/${tenant.slug}/mail`}>
              <Card className="rounded-2xl transition hover:border-primary/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle>{tenant.name}</CardTitle>
                  <CardDescription>{tenant.slug} · Open business email workspace →</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default async function MailWorkspaceChooser() {
  return withRequestDatabase(() => renderMailWorkspaceChooser());
}
