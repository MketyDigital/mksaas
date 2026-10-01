import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { createEnterpriseAiSolutionInstance } from '@/features/ai-runtime/server/business-solution-actions';
import {
  getEnterpriseAiSolutionTemplate,
  listTenantProjectChoices,
} from '@/features/ai-runtime/server/business-solutions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ solution?: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const { solution: solutionKey } = await searchParams;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/app/${tenantSlug}/enterprise-ai`);

  const [solution, projects] = await Promise.all([
    getEnterpriseAiSolutionTemplate(solutionKey ?? ''),
    listTenantProjectChoices(tenant.id),
  ]);
  if (!solution) redirect(`/app/${tenantSlug}/enterprise-ai`);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai`}>
        <ArrowLeft className="h-4 w-4" /> Back to Mkety AI
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <Sparkles className="h-7 w-7 text-primary" />
            <CardTitle className="mt-3 text-3xl">{solution.title}</CardTitle>
            <CardDescription className="text-base leading-7">{solution.shortDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">What Mkety will guide you through</p>
            <ol className="mt-4 space-y-3">
              {solution.setupSteps.map((step, index) => (
                <li className="flex gap-3 text-sm text-muted-foreground" key={step}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{index + 1}</span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-primary/20">
          <CardHeader>
            <CardTitle>Start your setup</CardTitle>
            <CardDescription>No model, API, or infrastructure knowledge is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createEnterpriseAiSolutionInstance.bind(null, tenantSlug)} className="space-y-4">
              <input type="hidden" name="templateKey" value={solution.key} />
              <label className="block text-sm font-medium">
                What should we call this solution?
                <input className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5" defaultValue={solution.title} maxLength={160} name="name" required />
              </label>
              <label className="block text-sm font-medium">
                Project (optional)
                <select className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5" name="projectId">
                  <option value="">Decide later</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                Creating this setup does not publish anything or spend AI credits. Production actions remain protected until you review and activate them.
              </div>
              <button className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Create setup</button>
            </form>
          </CardContent>
        </Card>
      </div>

      <section className="rounded-2xl border p-5">
        <p className="font-semibold">Expected business results</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {solution.outcomes.map((outcome) => (
            <div className="flex gap-2 rounded-xl bg-muted/20 p-4 text-sm" key={outcome}><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{outcome}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
