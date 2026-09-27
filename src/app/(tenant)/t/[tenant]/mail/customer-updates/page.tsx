import { desc, eq } from 'drizzle-orm';
import { Send } from 'lucide-react';

import { createCustomerUpdate } from '@/features/mail/server/customer-update-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailCustomerUpdates, mailDomains, mailMailboxes } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function CustomerUpdatesPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const [mailboxes,domains,updates]=await Promise.all([
    db.query.mailMailboxes.findMany({where:eq(mailMailboxes.tenantId,access.tenant.id)}),
    db.query.mailDomains.findMany({where:eq(mailDomains.tenantId,access.tenant.id)}),
    db.query.mailCustomerUpdates.findMany({where:eq(mailCustomerUpdates.tenantId,access.tenant.id),orderBy:[desc(mailCustomerUpdates.createdAt)],limit:50}),
  ]);
  const senders=mailboxes.filter((mailbox)=>domains.find((domain)=>domain.id===mailbox.domainId)?.sendingEnabled);
  const action=createCustomerUpdate.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Send className="h-5 w-5"/>} title="Customer Updates" description="Send important service and business updates to customers you already have a relationship with."/>

    {query.queued&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">{query.queued} customer messages are queued for safe delivery.</div>}
    {query.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{query.error==='domain'?'Connect and verify a sending domain first.':query.error==='recipients'?'Add active contacts before sending an update.':query.error==='queue'?'Delivery could not be queued. Nothing will be sent until the dispatch service is available.':'Complete all fields and confirm these are existing customers or legitimate business contacts.'}</div>}

    <Card className="rounded-2xl">
      <CardHeader><CardTitle>New customer update</CardTitle><CardDescription>This is for service, account and operational communication. Marketing newsletters and promotions are Coming Soon.</CardDescription></CardHeader>
      <CardContent>
        {!senders.length?<div className="space-y-3"><p className="text-sm text-muted-foreground">You need a verified sending mailbox first.</p><a className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/t/${tenant}/mail/domains`}>Connect domain</a></div>:
        <form action={action} className="grid gap-4">
          <label className="text-sm font-medium">Send from<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="mailboxId">{senders.map((mailbox)=>{const domain=domains.find((item)=>item.id===mailbox.domainId);return <option value={mailbox.id} key={mailbox.id}>{mailbox.localPart}@{domain?.domain}</option>;})}</select></label>
          <label className="text-sm font-medium">Internal name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="name" placeholder="September service update" required/></label>
          <label className="text-sm font-medium">Subject<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="subject" required/></label>
          <label className="text-sm font-medium">Message<textarea className="mt-2 min-h-48 w-full rounded-xl border bg-background px-4 py-3" name="message" required/></label>
          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" name="relationship" value="yes" required className="mt-1"/><span>I confirm these recipients are existing customers or legitimate business contacts and this message is not a promotional marketing blast.</span></label>
          <div className="flex flex-wrap items-center gap-3"><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Queue customer update</button><span className="text-xs text-muted-foreground">Up to 3,000 active, non-suppressed contacts per update.</span></div>
        </form>}
      </CardContent>
    </Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle>Recent updates</CardTitle></CardHeader><CardContent className="divide-y">{updates.map((update)=><div className="py-4" key={update.id}><div className="flex items-center justify-between gap-4"><div><p className="font-medium">{update.name}</p><p className="text-sm text-muted-foreground">{update.subject}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{update.status}</span></div><p className="mt-2 text-xs text-muted-foreground">{update.recipientCount} recipients · {update.deliveredCount} delivered · {update.bouncedCount} bounced · {update.failedCount} failed</p></div>)}{!updates.length&&<p className="py-8 text-center text-sm text-muted-foreground">No customer updates yet.</p>}</CardContent></Card>
  </div>;
}
