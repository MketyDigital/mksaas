import { and, eq } from 'drizzle-orm';
import { Archive, ArrowLeft, Forward, Reply, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchAttachmentManifest, fetchMailText } from '@/features/mail/server/content';
import { forwardMail, moveMailMessage, replyToMail, toggleMailStar } from '@/features/mail/server/message-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMailboxMembers, mailMessages } from '@/shared/db/schema';

export const dynamic='force-dynamic';

function plainFromHtml(value:string){
  return value
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p\s*>/gi,'\n\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/[ \t]+/g,' ')
    .replace(/\n\s+/g,'\n')
    .trim();
}

export default async function MailMessagePage({params,searchParams}:{params:Promise<{tenant:string;messageId:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant,messageId}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const message=await db.query.mailMessages.findFirst({
    where:and(eq(mailMessages.id,messageId),eq(mailMessages.tenantId,access.tenant.id)),
  });
  if(!message) notFound();

  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.id,message.mailboxId),eq(mailMailboxes.tenantId,access.tenant.id)),
  });
  if(!mailbox) notFound();

  if(!['admin','manager'].includes(String(access.membership.role))){
    const member=await db.query.mailMailboxMembers.findFirst({
      where:and(eq(mailMailboxMembers.mailboxId,mailbox.id),eq(mailMailboxMembers.userId,access.actor.userId)),
    });
    if(!member) notFound();
  }

  const textBody=await fetchMailText(message.textR2Key);
  const htmlBody=!textBody&&message.htmlR2Key?await fetchMailText(message.htmlR2Key):'';
  const body=textBody||plainFromHtml(htmlBody)||message.preview||'';
  const attachments=await fetchAttachmentManifest(message.rawR2Key);
  const backFolder=String(query.folder||message.folder||'inbox');
  const reply=replyToMail.bind(null,tenant);
  const forward=forwardMail.bind(null,tenant);
  const move=moveMailMessage.bind(null,tenant);
  const star=toggleMailStar.bind(null,tenant);
  const backHref='/t/'+tenant+'/mail/inbox?mailbox='+mailbox.id+'&folder='+encodeURIComponent(backFolder);

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Back to mail</Link>

    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="break-words text-xl">{message.subject||'(no subject)'}</CardTitle>
            <CardDescription className="mt-2">{message.direction==='outbound'?<>To: {message.toJson.join(', ')}</>:<>From: {message.fromAddress}</>}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <form action={star}><input type="hidden" name="messageId" value={message.id}/><button className="rounded-lg border p-2" title={message.isStarred?'Remove star':'Star'}><Star className={'h-4 w-4 '+(message.isStarred?'fill-current text-primary':'')}/></button></form>
            <form action={move}><input type="hidden" name="messageId" value={message.id}/><input type="hidden" name="folder" value="archive"/><button className="rounded-lg border p-2" title="Archive"><Archive className="h-4 w-4"/></button></form>
            <form action={move}><input type="hidden" name="messageId" value={message.id}/><input type="hidden" name="folder" value="trash"/><button className="rounded-lg border p-2" title="Move to trash"><Trash2 className="h-4 w-4"/></button></form>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap break-words text-sm leading-6">{body||'No readable message body was available.'}</div>
        {attachments.length>0&&<div className="mt-6 border-t pt-5"><p className="mb-3 text-sm font-semibold">Attachments</p><div className="flex flex-wrap gap-2">{attachments.map((attachment,index)=>{
          const href='/api/mail/attachments/'+message.id+'/'+index+'?tenant='+encodeURIComponent(tenant);
          return <a key={attachment.r2Key} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted" href={href}>{attachment.filename}{attachment.size?' · '+Math.max(1,Math.round(attachment.size/1024))+' KB':''}</a>;
        })}</div></div>}
      </CardContent>
    </Card>

    {message.direction==='inbound'&&<div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Reply className="h-4 w-4"/>Reply</CardTitle></CardHeader><CardContent><form action={reply} className="space-y-3"><input type="hidden" name="messageId" value={message.id}/><textarea name="message" required className="min-h-32 w-full rounded-xl border bg-background px-4 py-3" placeholder="Write your reply…"/><button className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Send reply</button></form></CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Forward className="h-4 w-4"/>Forward</CardTitle></CardHeader><CardContent><form action={forward} className="space-y-3"><input type="hidden" name="messageId" value={message.id}/><input name="to" type="email" required className="w-full rounded-xl border bg-background px-4 py-3" placeholder="recipient@example.com"/><textarea name="message" className="min-h-24 w-full rounded-xl border bg-background px-4 py-3" placeholder="Optional note"/><button className="rounded-xl border px-4 py-2.5 font-semibold">Forward email</button></form></CardContent></Card>
    </div>}
  </div>;
}
