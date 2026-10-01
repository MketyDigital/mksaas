import { BellRing } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  cancelEnterpriseAiCommitmentReminder,
  listEnterpriseAiCommitmentReminders,
} from '@/features/ai-runtime/channels/server/reminder-actions';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

function statusLabel(status: string) {
  if (status === 'reconciliation_required') return 'Needs review';
  if (status === 'sent') return 'Sent';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'failed') return 'Failed';
  if (status === 'claimed') return 'Sending';
  return 'Scheduled';
}

export default async function EnterpriseAiRemindersPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/app/${tenantSlug}/enterprise-ai`);

  const reminders = await listEnterpriseAiCommitmentReminders(tenant.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div>
        <Link className="text-sm text-muted-foreground" href={`/app/${tenantSlug}/enterprise-ai`}>← Enterprise AI</Link>
        <div className="mt-2 flex items-center gap-3">
          <BellRing className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Commitment reminders</h1>
        </div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Review reminders created only from explicit customer commitments with a future date/time. Cancel pending reminders here. Ambiguous provider outcomes never auto-resend; they stop for review.
        </p>
      </div>

      <div className="grid gap-3">
        {reminders.length ? reminders.map((reminder) => (
          <Card className="rounded-2xl" key={reminder.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{reminder.customer}</CardTitle>
                  <CardDescription>
                    {reminder.solutionName ?? 'Enterprise AI'} · {reminder.channel} · due {reminder.dueAt.toLocaleString()}
                  </CardDescription>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold">{statusLabel(reminder.status)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {reminder.commitment ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Commitment</p>
                  <p className="mt-1">{reminder.commitment}</p>
                </div>
              ) : null}
              {reminder.sourceQuote ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Customer evidence</p>
                  <p className="mt-1 rounded-lg border bg-muted/20 p-2">&ldquo;{reminder.sourceQuote}&rdquo;</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reminder message</p>
                <p className="mt-1 whitespace-pre-wrap">{reminder.reminderText}</p>
              </div>
              {reminder.lastError ? (
                <p className="rounded-lg border bg-amber-500/5 p-2 text-xs text-muted-foreground">
                  Delivery state: {reminder.lastError}
                </p>
              ) : null}
              {['pending', 'claimed'].includes(reminder.status) ? (
                <form action={cancelEnterpriseAiCommitmentReminder.bind(null, tenantSlug)}>
                  <input name="reminderId" type="hidden" value={reminder.id} />
                  <Button type="submit" variant="outline">Cancel reminder</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        )) : (
          <Card className="rounded-2xl">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No commitment reminders have been scheduled yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
