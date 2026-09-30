import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { authenticateMailApiKey } from '@/features/mail/server/api-auth';
import { pushMailQueueBatch } from '@/features/mail/server/cloudflare';
import { getMailSendCapacity } from '@/features/mail/server/sending-policy';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMessages, mailSuppressions } from '@/shared/db/schema';

function email(value:unknown){
  const normalized=String(value||'').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:'';
}

export async function POST(request:Request){
  const key=await authenticateMailApiKey(request);
  if(!key) return NextResponse.json({ok:false,error:'unauthorized'},{status:401});

  const body=await request.json().catch(()=>null) as {
    from?:string;
    to?:string;
    subject?:string;
    text?:string;
    html?:string;
  }|null;
  const from=email(body?.from);
  const to=email(body?.to);
  const subject=String(body?.subject||'').trim().slice(0,500);
  const text=String(body?.text||'').slice(0,200_000);
  const html=String(body?.html||'').slice(0,500_000);
  if(!from||!to||!subject||(!text&&!html)) return NextResponse.json({ok:false,error:'invalid_request'},{status:400});

  const at=from.lastIndexOf('@');
  const localPart=from.slice(0,at);
  const domainName=from.slice(at+1);
  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.tenantId,key.tenantId),eq(mailDomains.domain,domainName)),
  });
  if(!domain?.sendingEnabled) return NextResponse.json({ok:false,error:'sender_not_ready'},{status:409});

  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.tenantId,key.tenantId),eq(mailMailboxes.domainId,domain.id),eq(mailMailboxes.localPart,localPart),eq(mailMailboxes.status,'active')),
  });
  if(!mailbox) return NextResponse.json({ok:false,error:'sender_not_allowed'},{status:403});

  const capacity=await getMailSendCapacity(key.tenantId,domain.id,1);
  if(!capacity.allowed){
    const error=capacity.reason==='warmup'?'sender_warmup':capacity.reason==='monthly_limit'?'monthly_limit':'daily_limit';
    return NextResponse.json({ok:false,error,remaining:capacity.remaining,period:capacity.period},{status:429});
  }

  const suppression=await db.query.mailSuppressions.findFirst({
    where:and(eq(mailSuppressions.tenantId,key.tenantId),eq(mailSuppressions.email,to)),
  });
  if(suppression&&(!suppression.expiresAt||suppression.expiresAt.getTime()>Date.now())){
    return NextResponse.json({ok:false,error:'recipient_suppressed'},{status:409});
  }

  const [message]=await db.insert(mailMessages).values({
    tenantId:key.tenantId,
    mailboxId:mailbox.id,
    direction:'outbound',
    fromAddress:from,
    toJson:[to],
    subject,
    preview:(text||html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim().slice(0,240),
    status:'sending',
    folder:'sent',
  }).returning();

  try{
    await pushMailQueueBatch([{
      kind:'transactional',
      tenantId:key.tenantId,
      messageId:message.id,
      mailboxId:mailbox.id,
      from:{email:from,name:mailbox.displayName||undefined},
      to:{email:to},
      subject,
      ...(text?{text}:{}),
      ...(html?{html}:{}),
    }]);
    await db.update(mailMessages).set({status:'queued'}).where(eq(mailMessages.id,message.id));
    return NextResponse.json({ok:true,id:message.id,status:'queued'},{status:202});
  }catch{
    await db.update(mailMessages).set({status:'failed'}).where(eq(mailMessages.id,message.id));
    return NextResponse.json({ok:false,error:'queue_failed',id:message.id},{status:502});
  }
}
