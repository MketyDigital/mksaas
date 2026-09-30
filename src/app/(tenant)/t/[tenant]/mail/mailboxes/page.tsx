import { eq } from 'drizzle-orm';
import { Inbox, Users } from 'lucide-react';

import { createMailbox } from '@/features/mail/server/mailbox-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailWorkspaces } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailboxesPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,access.tenant.id)});
  if(!workspace) return null;
  const [domains,mailboxes]=await Promise.all([
    db.query.mailDomains.findMany({where:eq(mailDomains.workspaceId,workspace.id)}),
    db.query.mailMailboxes.findMany({where:eq(mailMailboxes.workspaceId,workspace.id)}),
  ]);
  const action=createMailbox.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Inbox className="h-5 w-5"/>} title="Mailboxes" description="Create the business addresses your customers will use."/>

    <Card className="rounded-2xl">
      <CardHeader><CardTitle>Create an email address</CardTitle><CardDescription>Examples: hello@company.com, sales@company.com or support@company.com.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {query.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Please check the mailbox details and try again.</div>}
        {!domains.length?<a className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/t/${tenant}/mail/domains`}>Connect a domain first</a>:
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Address name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="localPart" placeholder="hello" required/></label>
          <label className="text-sm font-medium">Domain<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="domainId">{domains.map(d=><option value={d.id} key={d.id}>@{d.domain}</option>)}</select></label>
          <label className="text-sm font-medium">Display name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="displayName" placeholder="Your Company"/></label>
          <label className="text-sm font-medium">Address type<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="type"><option value="personal">Personal inbox</option><option value="shared">Shared team inbox</option><option value="alias">Forward-only alias</option></select></label>
          <label className="text-sm font-medium md:col-span-2">Optional forwarding address<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="forwardingAddress" type="email" placeholder="owner@gmail.com"/></label>
          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm md:col-span-2"><input type="checkbox" name="catchAll" value="yes" className="mt-1"/><span>Use this as the catch-all inbox for addresses on this domain that do not have their own mailbox.</span></label>
          <div className="md:col-span-2"><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Create mailbox</button></div>
        </form>}
      </CardContent>
    </Card>

    <div className="grid gap-4 md:grid-cols-2">
      {mailboxes.map(mailbox=>{
        const domain=domains.find(d=>d.id===mailbox.domainId);
        return <Card className="rounded-2xl" key={mailbox.id}><CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{mailbox.type==='shared'?<Users className="h-5 w-5"/>:<Inbox className="h-5 w-5"/>}</div><div><CardTitle className="text-base">{mailbox.localPart}@{domain?.domain}</CardTitle><CardDescription>{mailbox.type==='shared'?'Shared business inbox':mailbox.type==='alias'?'Forward-only alias':'Personal business inbox'}{mailbox.catchAll?' · Catch-all':''}</CardDescription></div></div></div></CardHeader><CardContent>{mailbox.forwardingAddress&&<p className="text-sm text-muted-foreground">Forwarding to {mailbox.forwardingAddress}</p>}<a className="mt-3 inline-flex text-sm font-semibold text-primary" href={`/t/${tenant}/mail/inbox?mailbox=${mailbox.id}`}>Open inbox →</a></CardContent></Card>
      })}
    </div>
  </div>;
}
