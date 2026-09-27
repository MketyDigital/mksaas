import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/shared/db/cloudflare';
import { mailCustomerUpdateRecipients, mailCustomerUpdates, mailDeliveryEvents } from '@/shared/db/schema';

export async function POST(request:Request){
  const expected=process.env.MKETY_MAIL_INTERNAL_SECRET||'';
  const provided=request.headers.get('authorization')||'';
  if(!expected||provided!==`Bearer ${expected}`) return NextResponse.json({ok:false},{status:401});

  const payload=await request.json().catch(()=>null) as {
    tenantId?:string;
    updateId?:string;
    recipientId?:string;
    recipient?:string;
    status?:'sent'|'failed';
    providerMessageId?:string;
    errorCode?:string;
  }|null;
  if(!payload?.tenantId||!payload.updateId||!payload.recipientId||!payload.recipient||!payload.status){
    return NextResponse.json({ok:false},{status:400});
  }

  const tenantId=payload.tenantId;
  const updateId=payload.updateId;
  const recipientId=payload.recipientId;
  const recipientAddress=payload.recipient;
  const status=payload.status;

  const recipient=await db.query.mailCustomerUpdateRecipients.findFirst({
    where:eq(mailCustomerUpdateRecipients.id,recipientId),
  });
  if(!recipient||recipient.tenantId!==tenantId||recipient.updateId!==updateId){
    return NextResponse.json({ok:false},{status:404});
  }
  if(recipient.status!=='pending') return NextResponse.json({ok:true,duplicate:true});

  const now=new Date();
  await db.transaction(async(tx)=>{
    await tx.update(mailCustomerUpdateRecipients).set({
      status,
      providerMessageId:payload.providerMessageId||null,
      errorCode:payload.errorCode||null,
      sentAt:status==='sent'?now:null,
    }).where(eq(mailCustomerUpdateRecipients.id,recipient.id));

    await tx.insert(mailDeliveryEvents).values({
      tenantId,
      updateRecipientId:recipient.id,
      providerEventId:payload.providerMessageId||null,
      eventType:status,
      recipient:recipientAddress,
      payload:{errorCode:payload.errorCode||null},
      occurredAt:now,
    });

    await tx.update(mailCustomerUpdates).set({
      ...(status==='failed'?{failedCount:sql`${mailCustomerUpdates.failedCount}+1`}:{ }),
      updatedAt:now,
    }).where(eq(mailCustomerUpdates.id,updateId));
  });

  return NextResponse.json({ok:true});
}
