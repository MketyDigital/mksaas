import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { applyInboundMailAutomation } from '@/features/mail/server/automation-actions';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMessages, mailThreads } from '@/shared/db/schema';

export async function POST(request:Request){
  const secret=getMailInternalSecret();
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false},{status:401});
  const body=await request.json().catch(()=>null) as {
    tenantId?:string;mailboxId?:string;from?:string;to?:string;subject?:string;
    internetMessageId?:string;rawR2Key?:string;htmlR2Key?:string;textR2Key?:string;preview?:string;attachmentCount?:number;rawSize?:number;automated?:boolean;
  }|null;
  if(!body?.tenantId||!body.mailboxId||!body.from||!body.to||!body.rawR2Key) return NextResponse.json({ok:false},{status:400});
  const mailbox=await db.query.mailMailboxes.findFirst({where:eq(mailMailboxes.id,body.mailboxId)});
  if(!mailbox||mailbox.tenantId!==body.tenantId) return NextResponse.json({ok:false},{status:404});

  const now=new Date();
  const [thread]=await db.insert(mailThreads).values({
    tenantId:body.tenantId,
    mailboxId:body.mailboxId,
    subject:String(body.subject||'').slice(0,500)||null,
    status:'open',
    lastMessageAt:now,
  }).returning();

  const [message]=await db.insert(mailMessages).values({
    tenantId:body.tenantId,
    mailboxId:body.mailboxId,
    threadId:thread.id,
    direction:'inbound',
    internetMessageId:String(body.internetMessageId||'').slice(0,1000)||null,
    fromAddress:String(body.from).toLowerCase().slice(0,320),
    toJson:[String(body.to).toLowerCase().slice(0,320)],
    subject:String(body.subject||'').slice(0,500)||null,
    preview:String(body.preview||'').slice(0,240)||null,
    rawR2Key:String(body.rawR2Key),
    htmlR2Key:String(body.htmlR2Key||'')||null,
    textR2Key:String(body.textR2Key||'')||null,
    status:'received',
    folder:'inbox',
    receivedAt:now,
  }).returning();

  await applyInboundMailAutomation({
    tenantId:body.tenantId,
    mailboxId:body.mailboxId,
    threadId:thread.id,
    from:String(body.from).toLowerCase(),
    subject:String(body.subject||''),
    automated:Boolean(body.automated),
  }).catch(()=>undefined);

  return NextResponse.json({ok:true,messageId:message.id});
}
