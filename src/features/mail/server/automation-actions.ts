'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db/cloudflare';
import { mailAutomationRules, mailDomains, mailMailboxes, mailThreads } from '@/shared/db/schema';

import { sendCloudflareEmail } from './cloudflare';
import { requireMailWorkspaceAccess } from './workspace';

export async function createMailAutomationRule(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const mailboxId=String(formData.get('mailboxId')||'')||null;
  const name=String(formData.get('name')||'').trim().slice(0,255);
  const triggerType=String(formData.get('triggerType')||'all');
  const triggerValue=String(formData.get('triggerValue')||'').trim().slice(0,500);
  const actionType=String(formData.get('actionType')||'priority_high');
  const actionValue=String(formData.get('actionValue')||'').trim().slice(0,5000);
  if(!name) return;
  if(!['all','subject_contains','from_contains'].includes(triggerType)) return;
  if(!['priority_high','auto_reply'].includes(actionType)) return;
  if(actionType==='auto_reply'&&!actionValue) return;
  if(mailboxId){
    const mailbox=await db.query.mailMailboxes.findFirst({where:and(eq(mailMailboxes.id,mailboxId),eq(mailMailboxes.tenantId,tenant.id))});
    if(!mailbox) return;
  }
  await db.insert(mailAutomationRules).values({
    tenantId:tenant.id,mailboxId,name,triggerType,triggerValue:triggerValue||null,actionType,actionValue:actionValue||null,createdByUserId:actor.userId,
  });
  revalidatePath(`/app/${tenantSlug}/mail/automation`);
}

export async function deleteMailAutomationRule(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const id=String(formData.get('id')||'');
  await db.delete(mailAutomationRules).where(and(eq(mailAutomationRules.id,id),eq(mailAutomationRules.tenantId,tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/automation`);
}

export async function applyInboundMailAutomation(input:{
  tenantId:string;mailboxId:string;threadId:string;from:string;subject:string;automated:boolean;
}){
  const rules=await db.query.mailAutomationRules.findMany({where:and(eq(mailAutomationRules.tenantId,input.tenantId),eq(mailAutomationRules.enabled,true))});
  const matching=rules.filter((rule)=>{
    if(rule.mailboxId&&rule.mailboxId!==input.mailboxId) return false;
    const value=String(rule.triggerValue||'').toLowerCase();
    if(rule.triggerType==='subject_contains') return Boolean(value)&&input.subject.toLowerCase().includes(value);
    if(rule.triggerType==='from_contains') return Boolean(value)&&input.from.toLowerCase().includes(value);
    return rule.triggerType==='all';
  });
  if(!matching.length) return;

  const mailbox=await db.query.mailMailboxes.findFirst({where:eq(mailMailboxes.id,input.mailboxId)});
  const domain=mailbox?await db.query.mailDomains.findFirst({where:eq(mailDomains.id,mailbox.domainId)}):null;
  for(const rule of matching){
    if(rule.actionType==='priority_high'){
      await db.update(mailThreads).set({priority:'high',updatedAt:new Date()}).where(and(eq(mailThreads.id,input.threadId),eq(mailThreads.tenantId,input.tenantId)));
    }
    if(rule.actionType==='auto_reply'&&!input.automated&&mailbox&&domain?.sendingEnabled&&rule.actionValue){
      await sendCloudflareEmail({
        from:{email:`${mailbox.localPart}@${domain.domain}`,name:mailbox.displayName||undefined},
        to:[{email:input.from}],
        subject:input.subject.toLowerCase().startsWith('re:')?input.subject:`Re: ${input.subject}`,
        text:rule.actionValue,
        headers:{'X-Mkety-Auto-Reply':'1'},
      }).catch(()=>undefined);
    }
  }
}
