import { ArrowRight, BookOpen, Code2, CreditCard, Headphones, Lightbulb, Settings2, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ENTERPRISE_AI_SOLUTIONS } from '@/features/ai-runtime/business-solutions';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { getCreditBalance } from '@/features/usage-credits/server/service';
import { db } from '@/shared/db/cloudflare';
import { projects } from '@/shared/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMember } from '@/shared/lib/rbac';
import { getTenantBySlug } from '@/shared/lib/tenant';
import { eq } from 'drizzle-orm';

const ICONS = [Headphones, Lightbulb, BookOpen, Settings2, Users, Code2] as const;

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiConsolePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMember(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-8">
        <Card className="rounded-3xl">
          <CardHeader>
            <Sparkles className="h-8 w-8 text-primary" />
            <CardTitle className="mt-3 text-2xl">Enterprise AI is not active for this workspace</CardTitle>
            <CardDescription>
              Enterprise Mkety AI is a separate business solution from the normal AI Workspace. Activation is controlled by Mkety-owned billing and entitlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href="https://mkety.com/enterprise">
              Explore Enterprise AI
            </a>
            <Link className="rounded-xl border px-5 py-3 text-sm font-semibold" href={`/t/${tenantSlug}`}>
              Back to workspace
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [tenantProjects, balance] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, slug: projects.slug })
      .from(projects)
      .where(eq(projects.tenantId, tenant.id)),
    getCreditBalance(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-4">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/[0.08] via-background to-background p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Enterprise Mkety AI</p>
        <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">
          What do you want AI to help your business do?
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Start with the business result. Mkety handles the technical AI setup, permissions, usage protection, and approved connections behind the scenes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border bg-background px-4 py-2">Private to {tenant.name}</span>
          <span className="rounded-full border bg-background px-4 py-2">Prepaid usage protection</span>
          <span className="rounded-full border bg-background px-4 py-2">
            {tenantProjects.length} {tenantProjects.length === 1 ? 'project' : 'projects'}
          </span>
          <span className="rounded-full border bg-background px-4 py-2">
            {balance ? `${balance.availableCredits.toString()} credits available` : 'Credits not provisioned'}
          </span>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Choose a solution</h2>
          <p className="mt-1 text-sm text-muted-foreground">You can change or expand it later. Start with one clear business job.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ENTERPRISE_AI_SOLUTIONS.map((solution, index) => {
            const Icon = ICONS[index] ?? Sparkles;
            return (
              <Card className="group rounded-2xl transition hover:border-primary/40 hover:shadow-md" key={solution.key}>
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-3 text-lg">{solution.title}</CardTitle>
                  <CardDescription className="leading-6">{solution.shortDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {solution.outcomes.slice(0, 3).map((outcome) => (
                      <li className="flex gap-2" key={outcome}><span className="text-primary">✓</span>{outcome}</li>
                    ))}
                  </ul>
                  <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                    href={`/t/${tenantSlug}/enterprise-ai/setup?solution=${encodeURIComponent(solution.key)}`}
                  >
                    Start simple setup <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>Keep control of usage</CardTitle>
            <CardDescription>
              Mkety reserves credits before managed AI work and checks every applicable hard budget. Failed provider work releases the reservation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/wallet`}>
              <CreditCard className="mr-2 inline h-4 w-4" /> Usage & credits
            </Link>
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/billing`}>
              Billing
            </Link>
          </CardContent>
        </Card>

        <details className="rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Advanced / Developer</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Build with APIs, project-scoped keys, model routes, structured output, tools, and custom integrations when you need deeper control.
          </p>
          <div className="mt-4 grid gap-2">
            <a className="rounded-lg border px-3 py-2 text-sm font-medium" href="https://mkety.com/docs">Developer docs</a>
            <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href={`/t/${tenantSlug}/projects`}>Projects</Link>
          </div>
        </details>
      </section>
    </div>
  );
}
