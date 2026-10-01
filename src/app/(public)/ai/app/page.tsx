import { Building2, ExternalLink, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { withRequestDatabase } from '@/shared/db/request';
import { auth } from '@/shared/lib/auth';
import { getAllRoles } from '@/shared/lib/rbac';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const metadata = {
  title: 'Mkety AI — Choose your business',
  description: 'Choose the Mkety business workspace you want to use with Enterprise AI.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

async function renderEnterpriseAiProductAppPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?returnTo=%2Fai%2Fapp');

  const roles = await getAllRoles();
  const tenantSlugs = Object.keys(roles);

  if (tenantSlugs.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <Card className="w-full rounded-3xl">
          <CardHeader>
            <Sparkles className="h-7 w-7 text-primary" />
            <CardTitle className="mt-3 text-2xl">Create your business workspace first</CardTitle>
            <CardDescription>
              Mkety AI keeps your business information, permissions, usage, and billing inside a Mkety workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href="/create-workspace">
              <Plus className="h-4 w-4" /> Create workspace
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const organizations = (await Promise.all(
    tenantSlugs.map(async (slug) => {
      const tenant = await getTenantBySlug(slug);
      if (!tenant) return null;
      return {
        slug,
        name: tenant.name,
        role: roles[slug],
        entitled: await hasEnterpriseAiAccess(tenant.id),
      };
    }),
  )).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const entitled = organizations.filter((item) => item.entitled);
  if (entitled.length === 1 && organizations.length === 1) {
    redirect(`/app/${entitled[0].slug}/enterprise-ai`);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <div className="max-w-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety AI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Which business do you want AI to help?</h1>
        <p className="mt-3 text-muted-foreground">
          Choose a workspace. You do not need to understand models, APIs, or technical AI settings to get started.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {organizations.map((item) => (
          <Card className="rounded-2xl" key={item.slug}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="rounded-full border px-2.5 py-1 text-xs capitalize text-muted-foreground">{item.role}</span>
              </div>
              <CardTitle className="mt-3">{item.name}</CardTitle>
              <CardDescription>
                {item.entitled
                  ? 'Enterprise AI is available for this workspace.'
                  : 'Enterprise AI has not been activated for this workspace.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {item.entitled ? (
                <Link className="inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href={`/app/${item.slug}/enterprise-ai`}>
                  Open Mkety AI
                </Link>
              ) : (
                <a className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" href="https://mkety.com/contact#enterprise">
                  Request Enterprise AI access <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

export default async function EnterpriseAiProductAppPage() {
  return withRequestDatabase(() => renderEnterpriseAiProductAppPage());
}
