import { desc, eq } from 'drizzle-orm';
import { Inbox } from 'lucide-react';

import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMessages } from '@/shared/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';

export const dynamic='force-dynamic';

export default async function MailInboxPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const mailboxes=await db.query.mailMailboxes.findMany({where:eq(mailMailboxes.tenantId,access.tenant.id)});
  const selected=mailboxes.find(m=>m.id===query.mailbox)||mailboxes[0]||null;
  const messages=selected?await db.query.mailMessages.findMany({where:eq(mailMessages.mailboxId,selected.id),orderBy:[desc(mailMessages.createdAt)],limit:50}):[];

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Inbox className="h-5 w-5"/>} title="Inbox" description="Business conversations in one simple place."/>
    {!selected?<Card className="rounded-2xl"><CardContent className="py-8"><p className="text-sm text-muted-foreground">Create your first mailbox to start receiving email.</p><a className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/t/${tenant}/mail/mailboxes`}>Create mailbox</a></CardContent></Card>:
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Mailboxes</CardTitle></CardHeader><CardContent className="space-y-2">{mailboxes.map(m=><a key={m.id} href={`/t/${tenant}/mail/inbox?mailbox=${m.id}`} className={`block rounded-lg px-3 py-2 text-sm ${selected.id===m.id?'bg-primary/10 font-semibold text-primary':'hover:bg-muted'}`}>{m.localPart}</a>)}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle>{selected.localPart}</CardTitle><CardDescription>{messages.length} recent messages</CardDescription></CardHeader><CardContent className="divide-y">{messages.map(message=><div className="py-4" key={message.id}><div className="flex items-center justify-between gap-4"><p className="font-medium">{message.fromAddress}</p><span className="text-xs text-muted-foreground">{message.createdAt.toLocaleString()}</span></div><p className="mt-1 text-sm font-medium">{message.subject||'(no subject)'}</p>{message.preview&&<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{message.preview}</p>}</div>)}{!messages.length&&<div className="py-10 text-center text-sm text-muted-foreground">No mail yet. Messages sent to this mailbox will appear here once inbound routing is active.</div>}</CardContent></Card>
    </div>}
  </div>;
}
