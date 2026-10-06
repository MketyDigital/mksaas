import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import {
  mailCustomerUpdateRecipients,
  mailCustomerUpdates,
  mailDeliveryEvents,
  mailMessages,
} from '@/shared/db/schema';

export async function POST(request:Request){
  const expected=getMailInternalSecret();
  const provided=request.headers.get('authorization')||'';
  if(!expected||provided!==`Bearer ${expected}`) return NextResponse.json({ok:false},{status:401});

  const payload=await request.json().catch(()=>null) as {
    kind?:'customer_update'|'transactional'|'inbox';
    tenantId?:string;
    messageId?:string;
    mailboxId?:string;
    updateId?:string;
    recipientId?:string;
    recipient?:string;
    status?:'sent'|'failed';
    providerMessageId?:string;
    errorCode?:string;
    textR2Key?:string;
    htmlR2Key?:string;
  }|null;
  if(!payload?.kind||!payload.tenantId||!payload.recipient||!payload.status){
    return NextResponse.json({ok:false},{status:400});
  }

  const tenantId=payload.tenantId;
  const recipientAddress=payload.recipient;
  const status=payload.status;
  const now=new Date();

  if(payload.kind==='customer_update'){
    if(!payload.updateId||!payload.recipientId) return NextResponse.json({ok:false},{status:400});
    const updateId=payload.updateId;
    const recipientId=payload.recipientId;
    const recipient=await db.query.mailCustomerUpdateRecipients.findFirst({
      where:and(eq(mailCustomerUpdateRecipients.id,recipientId),eq(mailCustomerUpdateRecipients.tenantId,tenantId)),
    });
    if(!recipient||recipient.updateId!==updateId) return NextResponse.json({ok:false},{status:404});
    if(recipient.status!=='pending') return NextResponse.json({ok:true,duplicate:true});

    await db.transaction(async(tx)=>{
      await tx.update(mailCustomerUpdateRecipients).set({
        status,
        providerMessageId:payload.providerMessageId||null,
        errorCode:payload.errorCode||null,
        sentAt:status==='sent'?now:null,
      }).where(and(eq(mailCustomerUpdateRecipients.id,recipient.id),eq(mailCustomerUpdateRecipients.tenantId,tenantId)));

      await tx.insert(mailDeliveryEvents).values({
        tenantId,
        updateRecipientId:recipient.id,
        providerEventId:null,
        eventType:status,
        recipient:recipientAddress,
        payload:{providerMessageId:payload.providerMessageId||null,errorCode:payload.errorCode||null},
        occurredAt:now,
      });

      await tx.update(mailCustomerUpdates).set({
        ...(status==='failed'?{failedCount:sql`${mailCustomerUpdates.failedCount}+1`}:{}),
        updatedAt:now,
      }).where(and(eq(mailCustomerUpdates.id,updateId),eq(mailCustomerUpdates.tenantId,tenantId)));
    });
    return NextResponse.json({ok:true});
  }

  if(!payload.messageId) return NextResponse.json({ok:false},{status:400});
  const message=await db.query.mailMessages.findFirst({
    where:and(eq(mailMessages.id,payload.messageId),eq(mailMessages.tenantId,tenantId)),
  });
  if(!message) return NextResponse.json({ok:false},{status:404});
  if(!['queued','sending'].includes(message.status)) return NextResponse.json({ok:true,duplicate:true});

  await db.transaction(async(tx)=>{
    await tx.update(mailMessages).set({
      providerMessageId:payload.providerMessageId||message.providerMessageId,
      status,
      textR2Key:payload.textR2Key||message.textR2Key,
      htmlR2Key:payload.htmlR2Key||message.htmlR2Key,
      sentAt:status==='sent'?now:message.sentAt,
    }).where(and(eq(mailMessages.id,message.id),eq(mailMessages.tenantId,tenantId)));

    await tx.insert(mailDeliveryEvents).values({
      tenantId,
      messageId:message.id,
      providerEventId:null,
      eventType:status,
      recipient:recipientAddress,
      payload:{providerMessageId:payload.providerMessageId||null,errorCode:payload.errorCode||null},
      occurredAt:now,
    });
  });

  return NextResponse.json({ok:true});
}
