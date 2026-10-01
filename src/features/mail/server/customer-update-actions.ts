'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getMailCommercialPlan, normalizeMailPlanKey } from '@/features/mail/commercial/plans';
import { db } from '@/shared/db/cloudflare';
import {
  mailContacts,
  mailCustomerUpdateRecipients,
  mailCustomerUpdates,
  mailDomains,
  mailMailboxes,
  mailSuppressions,
} from '@/shared/db/schema';

import { pushMailQueueBatch } from './cloudflare';
import { getMailSendCapacity } from './sending-policy';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

function chunks<T>(values:T[],size:number){
  const result:T[][]=[];
  for(let index=0;index<values.length;index+=size) result.push(values.slice(index,index+size));
  return result;
}

export async function createCustomerUpdate(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const mailboxId=String(formData.get('mailboxId')||'');
  const name=String(formData.get('name')||'').trim().slice(0,255);
  const subject=String(formData.get('subject')||'').trim().slice(0,500);
  const text=String(formData.get('message')||'').trim().slice(0,100_000);
  const confirmation=String(formData.get('relationship')||'')==='yes';
  if(!name||!subject||!text||!confirmation){
    redirect(`/app/${tenantSlug}/mail/customer-updates?error=details`);
  }

  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.id,mailboxId),eq(mailMailboxes.tenantId,tenant.id)),
  });
  if(!mailbox) redirect(`/app/${tenantSlug}/mail/customer-updates?error=mailbox`);
  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.id,mailbox.domainId),eq(mailDomains.tenantId,tenant.id)),
  });
  if(!domain?.sendingEnabled){
    redirect(`/app/${tenantSlug}/mail/customer-updates?error=domain`);
  }

  const workspace=await getMailWorkspace(tenantSlug);
  if(!workspace) redirect(`/app/${tenantSlug}/mail?error=workspace`);
  const plan=getMailCommercialPlan(normalizeMailPlanKey(workspace.planKey));
  const recipientLimit=Math.min(3000,plan.limits.maxRecipientsPerCustomerUpdate);

  const [contacts,suppressions]=await Promise.all([
    db.query.mailContacts.findMany({where:and(eq(mailContacts.tenantId,tenant.id),eq(mailContacts.status,'active')),limit:recipientLimit}),
    db.query.mailSuppressions.findMany({where:eq(mailSuppressions.tenantId,tenant.id)}),
  ]);
  const suppressed=new Set(suppressions.map((row)=>row.email.toLowerCase()));
  const recipients=contacts.filter((contact)=>!suppressed.has(contact.email.toLowerCase())).slice(0,recipientLimit);
  if(!recipients.length) redirect(`/app/${tenantSlug}/mail/customer-updates?error=recipients`);
  const capacity=await getMailSendCapacity(tenant.id,domain.id,recipients.length,'customer_update');
  if(!capacity.allowed){
    const reason=capacity.reason==='warmup'?'warmup':'limit';
    redirect(`/app/${tenantSlug}/mail/customer-updates?error=${reason}&remaining=${capacity.remaining}`);
  }

  const [update]=await db.insert(mailCustomerUpdates).values({
    tenantId:tenant.id,
    mailboxId:mailbox.id,
    name,
    subject,
    text,
    status:'queueing',
    recipientCount:recipients.length,
    createdByUserId:actor.userId,
    startedAt:new Date(),
  }).returning();

  const rows=await db.insert(mailCustomerUpdateRecipients).values(recipients.map((contact)=>({
    tenantId:tenant.id,
    updateId:update.id,
    contactId:contact.id,
    email:contact.email,
    status:'pending',
  }))).returning();

  const from=`${mailbox.localPart}@${domain.domain}`;
  try{
    for(const batch of chunks(rows,100)){
      await pushMailQueueBatch(batch.map((recipient)=>({
        kind:'customer_update',
        tenantId:tenant.id,
        updateId:update.id,
        recipientId:recipient.id,
        from:{email:from,name:mailbox.displayName||undefined},
        to:{email:recipient.email},
        subject,
        text,
      })));
    }
    await db.update(mailCustomerUpdates).set({
      status:'queued',
      queuedCount:rows.length,
      updatedAt:new Date(),
    }).where(eq(mailCustomerUpdates.id,update.id));
  }catch{
    await db.update(mailCustomerUpdates).set({status:'queue_failed',updatedAt:new Date()}).where(eq(mailCustomerUpdates.id,update.id));
    redirect(`/app/${tenantSlug}/mail/customer-updates?error=queue`);
  }

  revalidatePath(`/app/${tenantSlug}/mail/customer-updates`);
  redirect(`/app/${tenantSlug}/mail/customer-updates?queued=${rows.length}`);
}
