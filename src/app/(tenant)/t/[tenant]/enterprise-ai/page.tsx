import { ArrowRight, Code2, CreditCard, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import {
  listEnterpriseAiSolutionInstances,
  listEnterpriseAiSolutionTemplates,
  listTenantProjectChoices,
} from '@/features/ai-runtime/server/business-solutions';
import { getCreditBalance } from '@/features/usage-credits/server/service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiConsolePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card className="rounded-3xl">
          <CardHeader>
            <Sparkles className="h-8 w-8 text-primary" />
            <CardTitle className="mt-3 text-2xl">Enterprise AI is not active for this workspace</CardTitle>
            <CardDescription>
              Enterprise Mkety AI is a separate business solution from the normal AI Workspace. Access only becomes active from Mkety-owned billing and entitlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href="https://mkety.com/enterprise">Explore Enterprise AI</a>
            <Link className="rounded-xl border px-5 py-3 text-sm font-semibold" href={`/t/${tenantSlug}`}>Back to workspace</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [templates, instances, projects, balance] = await Promise.all([
    listEnterpriseAiSolutionTemplates(),
    listEnterpriseAiSolutionInstances(tenant.id),
    listTenantProjectChoices(tenant.id),
    getCreditBalance(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-4">
      <section className="rounded-3xl border bg-primary/[0.04] p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety AI for {tenant.name}</p>
        <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">What do you want AI to help your business do?</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Start with the result you want. Mkety keeps model choice, routing, permissions, budgets and technical setup behind simple business controls.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border bg-background px-4 py-2">Private to your workspace</span>
          <span className="rounded-full border bg-background px-4 py-2">Prepaid usage protection</span>
          <span className="rounded-full border bg-background px-4 py-2">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
          <span className="rounded-full border bg-background px-4 py-2">{balance ? `${balance.availableCredits.toString()} credits available` : 'Credits not provisioned'}</span>
        </div>
      </section>

      {instances.length ? (
        <section>
          <h2 className="text-2xl font-bold">Your AI solutions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Continue a setup you already started.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {instances.slice(0, 6).map((instance) => (
              <Link className="rounded-2xl border bg-card p-5 transition hover:border-primary/40" href={`/t/${tenantSlug}/enterprise-ai/solutions/${instance.id}`} key={instance.id}>
                <p className="font-semibold">{instance.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{instance.status === 'draft' ? 'Setup in progress' : instance.status}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-2xl font-bold">Choose a solution</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start with one clear business job. You can expand it later.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((solution) => (
            <Card className="group rounded-2xl transition hover:border-primary/40 hover:shadow-md" key={solution.key}>
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
                <CardTitle className="mt-3 text-lg">{solution.title}</CardTitle>
                <CardDescription className="leading-6">{solution.shortDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {solution.outcomes.slice(0, 3).map((outcome) => <li className="flex gap-2" key={outcome}><span className="text-primary">✓</span>{outcome}</li>)}
                </ul>
                <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary" href={`/t/${tenantSlug}/enterprise-ai/setup?solution=${encodeURIComponent(solution.key)}`}>
                  Start simple setup <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage stays under control</CardTitle>
            <CardDescription>Mkety checks prepaid credits and every applicable hard budget before managed AI work can start.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/wallet`}><CreditCard className="mr-2 inline h-4 w-4" /> Usage & credits</Link>
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/billing`}>Billing</Link>
          </CardContent>
        </Card>

        <details className="rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Advanced / Developer</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Open APIs, project-scoped keys, models, tools and custom integrations only when your team needs them.</p>
          <div className="mt-4 grid gap-2">
            <a className="rounded-lg border px-3 py-2 text-sm font-medium" href="https://mkety.com/docs"><Code2 className="mr-2 inline h-4 w-4" /> Developer docs</a>
            <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href={`/t/${tenantSlug}/projects`}>Projects</Link>
          </div>
        </details>
      </section>
    </div>
  );
}
