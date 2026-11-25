import { and, desc, eq } from 'drizzle-orm';
import { Archive, Inbox, MailPlus, Send, Star, Trash2 } from 'lucide-react';

import { composeMail } from '@/features/mail/server/message-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { isMailSendingDomainReady } from '@/features/mail/server/domain-sending-readiness';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMailboxMembers, mailMessages } from '@/shared/db/schema';

export const dynamic='force-dynamic';

const folders=[
  ['inbox','Inbox',Inbox],
  ['sent','Sent',Send],
  ['drafts','Drafts',MailPlus],
  ['archive','Archive',Archive],
  ['trash','Trash',Trash2],
  ['starred','Starred',Star],
] as const;

export default async function MailInboxPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const testMode=query.test==='1';
  const access=await requireMailWorkspaceAccess(tenant);
  const [allMailboxes,memberRows,domains]=await Promise.all([
    db.query.mailMailboxes.findMany({where:and(eq(mailMailboxes.tenantId,access.tenant.id),eq(mailMailboxes.status,'active'))}),
    db.query.mailMailboxMembers.findMany({where:and(eq(mailMailboxMembers.tenantId,access.tenant.id),eq(mailMailboxMembers.userId,access.actor.userId))}),
    db.query.mailDomains.findMany({where:eq(mailDomains.tenantId,access.tenant.id)}),
  ]);
  const allowed=new Set(memberRows.map((row)=>row.mailboxId));
  const mailboxes=['admin','manager'].includes(String(access.membership.role))?allMailboxes:allMailboxes.filter((mailbox)=>allowed.has(mailbox.id));
  const selected=mailboxes.find((mailbox)=>mailbox.id===query.mailbox)||mailboxes[0]||null;
  const selectedDomain=selected?domains.find((domain)=>domain.id===selected.domainId)||null:null;
  const senderReady=selectedDomain?isMailSendingDomainReady(selectedDomain):false;
  const errorMessage=query.error?({
    details:'Enter a valid recipient, subject and message before sending.',
    mailbox:'That mailbox is unavailable or you no longer have access to it. Choose an active mailbox.',
    suppressed:'This recipient is on your workspace suppression list, so Mail blocked the send.',
    domain:'Sending is blocked because this domain is not ready. Enable sending and verify SPF, DKIM and DMARC on Business domains, then retry setup.',
    limit:'Your current Mail sending allowance or domain warmup limit has been reached.',
    queue:'The message could not be accepted by the Mail delivery queue. It was not sent; check Mail delivery diagnostics or contact support.',
  } as Record<string,string>)[query.error]||'Mail could not complete this send. Open Business domains to review sender readiness, or check delivery diagnostics.' : '';
  const folder=folders.some(([key])=>key===query.folder)?String(query.folder):'inbox';
  const messages=selected?await db.query.mailMessages.findMany({
    where:folder==='starred'
      ?and(eq(mailMessages.mailboxId,selected.id),eq(mailMessages.isStarred,true))
      :and(eq(mailMessages.mailboxId,selected.id),eq(mailMessages.folder,folder)),
    orderBy:[desc(mailMessages.createdAt)],
    limit:100,
  }):[];
  const compose=composeMail.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Inbox className="h-5 w-5"/>} title="Inbox" description="Send, receive and manage your business conversations in one simple place."/>

    {(query.sent||query.saved)&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><span>{query.sent?'Message queued for secure delivery.':'Draft saved.'}</span>{query.sent&&selected&&<a className="font-semibold text-primary" href={`/app/${tenant}/mail/inbox?mailbox=${selected.id}&folder=sent`}>Open Sent →</a>}</div>}
    {testMode&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">Send this to an address you can check. This uses the selected mailbox and the normal send pipeline. Queue acceptance means the message was handed to delivery; it does not prove the recipient server accepted it.</div>}
    {selected&&(!senderReady||testMode)&&<Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Sender readiness</CardTitle><CardDescription>{selectedDomain?`${selected.localPart}@${selectedDomain.domain}`:'No domain is connected to the selected mailbox.'} · {senderReady?'ready to send':'sending blocked until domain authentication is ready'}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p>SPF: {selectedDomain?.spfStatus||'unknown'} · DKIM: {selectedDomain?.dkimStatus||'unknown'} · DMARC: {selectedDomain?.dmarcStatus||'unknown'}</p><p className="text-muted-foreground">Sending stays blocked until sending is enabled and SPF, DKIM, and DMARC are verified. A message queued before DNS authentication is ready may be rejected or sent to spam.</p><a className="font-semibold text-primary" href={`/app/${tenant}/mail/domains`}>Review Business domains →</a></CardContent></Card>}
    {query.error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{errorMessage}</p>{(query.error==='domain'||query.error==='queue'||!['details','mailbox','suppressed','limit'].includes(query.error))&&<a className="mt-2 inline-block font-semibold text-primary" href={`/app/${tenant}/mail/domains`}>{query.error==='queue'?'Review delivery setup →':'Open Business domains →'}</a>}</div>}

    {!selected?<Card className="rounded-2xl"><CardContent className="py-8"><p className="text-sm text-muted-foreground">Create your first mailbox to start sending and receiving email.</p><a className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/app/${tenant}/mail/mailboxes`}>Create mailbox</a></CardContent></Card>:
    <>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Compose</CardTitle><CardDescription>{testMode?'Send a test message through the same delivery pipeline used for regular mail.':'Send from your verified business address or save the message as a draft.'}</CardDescription></CardHeader>
        <CardContent><form action={compose} className="grid gap-3">
          <label className="text-sm font-medium">From<select name="mailboxId" defaultValue={selected.id} className="mt-2 w-full rounded-xl border bg-background px-4 py-3">{mailboxes.map((mailbox)=>{const domain=domains.find((item)=>item.id===mailbox.domainId);return <option key={mailbox.id} value={mailbox.id}>{mailbox.displayName?mailbox.displayName+' · ':''}{mailbox.localPart}@{domain?.domain}</option>;})}</select></label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium md:col-span-2">To<input name="to" type="email" className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="customer@example.com" required={testMode}/></label>
            <label className="text-sm font-medium">CC<input name="cc" type="email" className="mt-2 w-full rounded-xl border bg-background px-4 py-3"/></label>
          </div>
          <label className="text-sm font-medium">BCC<input name="bcc" type="email" className="mt-2 w-full rounded-xl border bg-background px-4 py-3"/></label>
          <label className="text-sm font-medium">Subject<input name="subject" defaultValue={testMode?"Mkety Mail delivery test":""} required={testMode} className="mt-2 w-full rounded-xl border bg-background px-4 py-3"/></label>
          <label className="text-sm font-medium">Message<textarea name="message" defaultValue={testMode?"This is a test message sent from the Mkety Mail workspace. If you received it, outbound email delivery is working for this mailbox.":""} required={testMode} className="mt-2 min-h-40 w-full rounded-xl border bg-background px-4 py-3"/></label>
          <div className="flex flex-wrap gap-3">
            <button name="mode" value="send" disabled={!senderReady} title={!senderReady?"Complete SPF, DKIM and DMARC verification to send":undefined} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{testMode?"Send test email":"Send email"}</button>
            <button name="mode" value="draft" className="rounded-xl border px-5 py-3 font-semibold">Save draft</button>
          </div>
        </form></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Mail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">{mailboxes.map((mailbox)=>{const domain=domains.find((item)=>item.id===mailbox.domainId);return <a key={mailbox.id} href={`/app/${tenant}/mail/inbox?mailbox=${mailbox.id}&folder=${folder}`} className={`block rounded-lg px-3 py-2 text-sm ${selected.id===mailbox.id?'bg-primary/10 font-semibold text-primary':'hover:bg-muted'}`}>{mailbox.localPart}@{domain?.domain}</a>;})}</div>
            <div className="border-t pt-3">{folders.map(([key,label,Icon])=><a key={key} href={`/app/${tenant}/mail/inbox?mailbox=${selected.id}&folder=${key}`} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${folder===key?'bg-muted font-semibold':'hover:bg-muted/60'}`}><Icon className="h-4 w-4"/>{label}</a>)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>{folders.find(([key])=>key===folder)?.[1]||'Inbox'}</CardTitle><CardDescription>{messages.length} recent messages</CardDescription></CardHeader>
          <CardContent className="divide-y">{messages.map((message)=><a href={`/app/${tenant}/mail/inbox/${message.id}?mailbox=${selected.id}&folder=${folder}`} className="block py-4 hover:bg-muted/30" key={message.id}><div className="flex items-center justify-between gap-4"><p className={`truncate ${message.isRead?'font-medium':'font-bold'}`}>{message.direction==='outbound'?(message.toJson[0]||'Recipient'):message.fromAddress}</p><span className="shrink-0 text-xs text-muted-foreground">{message.createdAt.toLocaleString()}</span></div><div className="mt-1 flex items-center gap-2"><p className="truncate text-sm font-medium">{message.subject||'(no subject)'}</p>{message.isStarred&&<Star className="h-3.5 w-3.5 fill-current text-primary"/>}</div>{message.preview&&<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{message.preview}</p>}</a>)}{!messages.length&&<div className="py-10 text-center text-sm text-muted-foreground">Nothing here yet.</div>}</CardContent>
        </Card>
      </div>
    </>}
  </div>;
}
