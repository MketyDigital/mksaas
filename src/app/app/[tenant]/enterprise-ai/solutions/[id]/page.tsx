import { ArrowLeft, CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { updateEnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solution-actions';
import {
  getEnterpriseAiSolutionInstance,
  getEnterpriseAiSolutionTemplate,
  parseEnterpriseAiSolutionConfiguration,
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
  const configuration = parseEnterpriseAiSolutionConfiguration(instance.configuration);

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

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Assistant settings</CardTitle>
          <CardDescription>
            These settings are runtime inputs for connected Enterprise AI channels. Pausing stops new managed AI turns without deleting configuration or channel credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={updateEnterpriseAiSolutionConfiguration.bind(null, tenantSlug, instance.id)}
            className="grid gap-5"
          >
            <label className="grid gap-2 text-sm font-medium">
              Status
              <select className="rounded-xl border bg-background px-3 py-2.5" defaultValue={instance.status} name="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Default managed model
              <select className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.defaultModelAlias} name="defaultModelAlias">
                <option value="mkety-economy">Mkety Economy · Gemma 4</option>
                <option value="mkety-smart">Mkety Smart · GLM-5.3 Flash</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              System instructions
              <textarea
                className="min-h-40 rounded-xl border bg-background p-3 text-sm"
                defaultValue={configuration.systemPrompt}
                maxLength={40000}
                name="systemPrompt"
                placeholder="Describe the assistant's role, tone, rules, escalation behavior and business boundaries."
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Approved knowledge
              <textarea
                className="min-h-56 rounded-xl border bg-background p-3 text-sm"
                defaultValue={configuration.knowledgeText}
                maxLength={120000}
                name="knowledgeText"
                placeholder="Add approved facts, FAQs, policies, product information and operating guidance for this solution."
              />
              <span className="text-xs font-normal text-muted-foreground">
                This is solution-scoped context. Project knowledge and provider credentials remain separate protected resources.
              </span>
            </label>
            <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Reply pacing
                <select className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.replyDelayMode} name="replyDelayMode">
                  <option value="off">Immediate</option>
                  <option value="fixed">Fixed delay</option>
                  <option value="range">Natural range</option>
                </select>
                <span className="text-xs font-normal text-muted-foreground">
                  Adds a controlled delivery delay after the answer is generated. The assistant remains clearly an AI; this setting only controls pacing.
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-medium">
                  Minimum seconds
                  <input className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.replyDelayMinSeconds} min={0} max={900} name="replyDelayMinSeconds" type="number" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Maximum seconds
                  <input className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.replyDelayMaxSeconds} min={0} max={900} name="replyDelayMaxSeconds" type="number" />
                </label>
              </div>
            </div>
            <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
              <label aria-label="Commitment reminders" htmlFor="commitment-reminders" className="flex items-start gap-3 text-sm md:col-span-2">
                <input id="commitment-reminders" className="mt-1" defaultChecked={configuration.commitmentRemindersEnabled} name="commitmentRemindersEnabled" type="checkbox" />
                <span>
                  <strong>Commitment reminders</strong>
                  <span className="mt-1 block text-muted-foreground">
                    When a customer clearly promises a future action and gives a date/time, the assistant may schedule one tenant-scoped reminder on supported asynchronous channels. Telegram, Slack, Discord and custom webhook are supported now; Meta channels wait for template/window-aware delivery. Ambiguous dates are not scheduled.
                  </span>
                </span>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Reminder timezone
                <input className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.reminderTimezone} maxLength={80} name="reminderTimezone" placeholder="Africa/Lagos" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Lead time (minutes)
                <input className="rounded-xl border bg-background px-3 py-2.5" defaultValue={configuration.reminderLeadMinutes} min={0} max={10080} name="reminderLeadMinutes" type="number" />
                <span className="text-xs font-normal text-muted-foreground">0 sends at the promised time; 60 sends one hour before.</span>
              </label>
            </div>
            <label aria-label="Pause AI replies" htmlFor="pause-ai-replies" className="flex items-start gap-3 rounded-xl border p-4 text-sm">
              <input id="pause-ai-replies" className="mt-1" defaultChecked={configuration.paused} name="paused" type="checkbox" />
              <span>
                <strong>Pause AI replies</strong>
                <span className="mt-1 block text-muted-foreground">
                  Keep the assistant, knowledge and channel setup intact while new automated replies are stopped.
                </span>
              </span>
            </label>
            <button className="w-fit rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Save assistant settings
            </button>
          </form>
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
