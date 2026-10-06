import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes } from '@/shared/db/schema';

function authorized(request:Request){
  const secret=getMailInternalSecret();
  return Boolean(secret)&&request.headers.get('authorization')===`Bearer ${secret}`;
}

export async function POST(request:Request){
  if(!authorized(request)) return NextResponse.json({ok:false},{status:401});
  const body=await request.json().catch(()=>null) as {recipient?:string}|null;
  const recipient=String(body?.recipient||'').trim().toLowerCase();
  const at=recipient.lastIndexOf('@');
  if(at<=0) return NextResponse.json({ok:false},{status:400});
  const localPart=recipient.slice(0,at);
  const domainName=recipient.slice(at+1);
  const domain=await db.query.mailDomains.findFirst({where:and(eq(mailDomains.domain,domainName),eq(mailDomains.routingEnabled,true))});
  if(!domain) return NextResponse.json({ok:false,accepted:false},{status:404});
  let mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.tenantId,domain.tenantId),eq(mailMailboxes.domainId,domain.id),eq(mailMailboxes.localPart,localPart),eq(mailMailboxes.status,'active')),
  });
  mailbox??=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.tenantId,domain.tenantId),eq(mailMailboxes.domainId,domain.id),eq(mailMailboxes.catchAll,true),eq(mailMailboxes.status,'active')),
  });
  if(!mailbox) return NextResponse.json({ok:false,accepted:false},{status:404});
  return NextResponse.json({
    ok:true,
    accepted:true,
    tenantId:domain.tenantId,
    domainId:domain.id,
    mailboxId:mailbox.id,
    forwardingAddress:mailbox.forwardingAddress||null,
  });
}
