import { ArrowLeft, CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import {
  getEnterpriseAiSolutionInstance,
  getEnterpriseAiSolutionTemplate,
} from '@/features/ai-runtime/server/business-solutions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiSolutionPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: tenantSlug, id } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/t/${tenantSlug}/enterprise-ai`);

  const instance = await getEnterpriseAiSolutionInstance(tenant.id, id);
  if (!instance) notFound();
  const template = await getEnterpriseAiSolutionTemplate(instance.templateKey);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href={`/t/${tenantSlug}/enterprise-ai`}>
        <ArrowLeft className="h-4 w-4" /> Back to Mkety AI
      </Link>

      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Sparkles className="h-7 w-7 text-primary" />
              <CardTitle className="mt-3 text-3xl">{instance.name}</CardTitle>
              <CardDescription className="mt-2 text-base">{template.shortDescription}</CardDescription>
            </div>
            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold capitalize">{instance.status}</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {template.setupSteps.map((step, index) => (
            <div className="rounded-xl border p-4" key={step}>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><p className="font-semibold">Step {index + 1}</p></div>
              <p className="mt-2 text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/20">
        <CardHeader>
          <LockKeyhole className="h-5 w-5 text-primary" />
          <CardTitle className="mt-2">Protected until you are ready</CardTitle>
          <CardDescription>
            This solution is a setup draft. It cannot silently publish, connect a paid provider, exceed prepaid credits, or bypass workspace permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {instance.projectId ? (
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/projects`}>Open projects</Link>
          ) : null}
          <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/t/${tenantSlug}/wallet`}>View credits</Link>
          <a className="rounded-xl border px-4 py-2 text-sm font-semibold" href="https://mkety.com/docs">Help & guides</a>
        </CardContent>
      </Card>
    </div>
  );
}
