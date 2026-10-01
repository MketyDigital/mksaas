import { eq } from 'drizzle-orm';
import { Workflow } from 'lucide-react';

import { createMailAutomationRule, deleteMailAutomationRule } from '@/features/mail/server/automation-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailAutomationRules, mailDomains, mailMailboxes } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailAutomationPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const access=await requireMailWorkspaceAccess(tenant);
  const [rules,mailboxes,domains]=await Promise.all([
    db.query.mailAutomationRules.findMany({where:eq(mailAutomationRules.tenantId,access.tenant.id)}),
    db.query.mailMailboxes.findMany({where:eq(mailMailboxes.tenantId,access.tenant.id)}),
    db.query.mailDomains.findMany({where:eq(mailDomains.tenantId,access.tenant.id)}),
  ]);
  const create=createMailAutomationRule.bind(null,tenant);
  const remove=deleteMailAutomationRule.bind(null,tenant);
  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Workflow className="h-5 w-5"/>} title="Automation" description="Set simple rules that help your business handle incoming mail automatically."/>
    <Card className="rounded-2xl"><CardHeader><CardTitle>New rule</CardTitle><CardDescription>Keep rules simple and predictable. You can prioritize matching messages or send a safe automatic reply.</CardDescription></CardHeader><CardContent><form action={create} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium md:col-span-2">Rule name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="name" placeholder="Urgent support messages" required/></label>
      <label className="text-sm font-medium">Mailbox<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="mailboxId"><option value="">All mailboxes</option>{mailboxes.map(m=>{const d=domains.find(x=>x.id===m.domainId);return <option value={m.id} key={m.id}>{m.localPart}@{d?.domain}</option>;})}</select></label>
      <label className="text-sm font-medium">When<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="triggerType"><option value="all">Any message arrives</option><option value="subject_contains">Subject contains</option><option value="from_contains">Sender contains</option></select></label>
      <label className="text-sm font-medium md:col-span-2">Match text<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="triggerValue" placeholder="e.g. urgent"/></label>
      <label className="text-sm font-medium">Then<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="actionType"><option value="priority_high">Mark conversation high priority</option><option value="auto_reply">Send automatic reply</option></select></label>
      <label className="text-sm font-medium">Auto-reply text<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="actionValue" placeholder="Thanks — we received your message."/></label>
      <div className="md:col-span-2"><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Create rule</button></div>
    </form></CardContent></Card>
    <div className="space-y-3">{rules.map(rule=><Card className="rounded-2xl" key={rule.id}><CardContent className="flex items-center justify-between gap-4 py-5"><div><p className="font-semibold">{rule.name}</p><p className="mt-1 text-sm text-muted-foreground">{rule.triggerType.replace('_',' ')} → {rule.actionType.replace('_',' ')}</p></div><form action={remove}><input type="hidden" name="id" value={rule.id}/><button className="text-sm text-muted-foreground hover:text-destructive">Delete</button></form></CardContent></Card>)}{!rules.length&&<p className="text-sm text-muted-foreground">No automation rules yet.</p>}</div>
  </div>;
}
