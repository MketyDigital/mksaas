import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { mailCustomerUpdateRecipients ,
  mailCustomerUpdates,
  mailDeliveryEvents,
  mailMessages,
  mailSuppressions,
  tenants,
} from '@/shared/db/schema';
import { emitWebhookEvent } from '@/shared/services/webhook-service';

type MailEventBody={
  type?:string;
  source?:{type?:string;domain?:string;zoneId?:string};
  payload?:{
    eventId?:string;
    messageId?:string;
    recipient?:string;
    terminal?:boolean;
    delivery?:{status?:string;smtpStatusCode?:string;smtpEnhancedStatusCode?:string;smtpResponse?:string};
    bounce?:{type?:string;classification?:string;reason?:string};
    complaint?:{type?:string};
    failure?:{reason?:string};
    rejection?:{reason?:string;party?:string;detail?:string};
  };
  metadata?:{eventTimestamp?:string};
};

function eventName(type:string){
  const value=type.split('.').pop()||'';
  return ['delivered','deferred','bounced','failed','rejected','complained'].includes(value)?value:'unknown';
}

export async function POST(request:Request){
  const expected=getMailInternalSecret();
  if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`) return NextResponse.json({ok:false},{status:401});

  const event=await request.json().catch(()=>null) as MailEventBody|null;
  const eventId=String(event?.payload?.eventId||'');
  const providerMessageId=String(event?.payload?.messageId||'');
  const recipient=String(event?.payload?.recipient||'').trim().toLowerCase();
  const type=eventName(String(event?.type||''));
  if(!eventId||!providerMessageId||!recipient||type==='unknown') return NextResponse.json({ok:false},{status:400});

  const duplicate=await db.query.mailDeliveryEvents.findFirst({where:eq(mailDeliveryEvents.providerEventId,eventId)});
  if(duplicate) return NextResponse.json({ok:true,duplicate:true});

  const updateRecipient=await db.query.mailCustomerUpdateRecipients.findFirst({
    where:eq(mailCustomerUpdateRecipients.providerMessageId,providerMessageId),
  });
  const message=updateRecipient?null:await db.query.mailMessages.findFirst({
    where:eq(mailMessages.providerMessageId,providerMessageId),
  });
  const tenantId=updateRecipient?.tenantId||message?.tenantId;
  if(!tenantId) return NextResponse.json({ok:true,ignored:true});

  const occurredAt=event?.metadata?.eventTimestamp?new Date(event.metadata.eventTimestamp):new Date();
  const payload={
    source:event?.source||{},
    delivery:event?.payload?.delivery||{},
    bounce:event?.payload?.bounce||{},
    complaint:event?.payload?.complaint||{},
    failure:event?.payload?.failure||{},
    rejection:event?.payload?.rejection||{},
    terminal:Boolean(event?.payload?.terminal),
  };

  await db.transaction(async(tx)=>{
    await tx.insert(mailDeliveryEvents).values({
      tenantId,
      messageId:message?.id||null,
      updateRecipientId:updateRecipient?.id||null,
      providerEventId:eventId,
      eventType:type,
      recipient,
      payload,
      occurredAt,
    });

    if(message){
      const status=type==='delivered'?'delivered':type==='deferred'?'deferred':type==='complained'?'complained':['bounced','failed','rejected'].includes(type)?type:message.status;
      await tx.update(mailMessages).set({status}).where(and(eq(mailMessages.id,message.id),eq(mailMessages.tenantId,tenantId)));
    }

    if(updateRecipient){
      const previous=updateRecipient.status;
      const terminalStatus=type==='delivered'?'delivered':type==='complained'?'complained':['bounced','failed','rejected'].includes(type)?type:null;
      if(terminalStatus){
        await tx.update(mailCustomerUpdateRecipients).set({
          status:terminalStatus,
          deliveredAt:type==='delivered'?occurredAt:updateRecipient.deliveredAt,
          errorCode:['bounced','failed','rejected'].includes(type)?String(event?.payload?.delivery?.smtpStatusCode||type):updateRecipient.errorCode,
        }).where(and(eq(mailCustomerUpdateRecipients.id,updateRecipient.id),eq(mailCustomerUpdateRecipients.tenantId,tenantId)));

        if(type==='delivered'&&previous!=='delivered'){
          await tx.update(mailCustomerUpdates).set({deliveredCount:sql`${mailCustomerUpdates.deliveredCount}+1`,updatedAt:new Date()}).where(eq(mailCustomerUpdates.id,updateRecipient.updateId));
        }
        if(type==='bounced'&&previous!=='bounced'){
          await tx.update(mailCustomerUpdates).set({bouncedCount:sql`${mailCustomerUpdates.bouncedCount}+1`,updatedAt:new Date()}).where(eq(mailCustomerUpdates.id,updateRecipient.updateId));
        }
        if((type==='failed'||type==='rejected')&&previous!==type){
          await tx.update(mailCustomerUpdates).set({failedCount:sql`${mailCustomerUpdates.failedCount}+1`,updatedAt:new Date()}).where(eq(mailCustomerUpdates.id,updateRecipient.updateId));
        }
        if(type==='complained'&&previous!=='complained'){
          await tx.update(mailCustomerUpdates).set({complainedCount:sql`${mailCustomerUpdates.complainedCount}+1`,updatedAt:new Date()}).where(eq(mailCustomerUpdates.id,updateRecipient.updateId));
        }
      }
    }

    const hardBounce=type==='bounced'&&String(event?.payload?.bounce?.type||'').toLowerCase()==='hard';
    if(hardBounce||type==='complained'){
      await tx.insert(mailSuppressions).values({
        tenantId,
        email:recipient,
        reason:hardBounce?'hard_bounce':'complaint',
        source:'cloudflare',
      }).onConflictDoNothing({target:[mailSuppressions.tenantId,mailSuppressions.email]});
    }
  });

  const tenant=await db.query.tenants.findFirst({where:eq(tenants.id,tenantId),columns:{slug:true}});
  if(tenant?.slug){
    await emitWebhookEvent(tenant.slug,`mail.${type}`,{
      providerMessageId,
      recipient,
      type,
      occurredAt:occurredAt.toISOString(),
      messageId:message?.id||null,
      customerUpdateRecipientId:updateRecipient?.id||null,
    }).catch(()=>undefined);
  }

  return NextResponse.json({ok:true});
}
