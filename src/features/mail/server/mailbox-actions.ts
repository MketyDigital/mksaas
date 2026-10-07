'use server';

import { and, count, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMailboxMembers, mailWorkspaces } from '@/shared/db/schema';

import { createCloudflareEmailWorkerRule, setCloudflareEmailCatchAll } from './cloudflare';
import { requireMailWorkspaceAccess } from './workspace';
import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';
import { canAssignMailTeamSeat } from './mail-team-seats';

function cleanLocalPart(value:string){
  return value.trim().toLowerCase().replace(/[^a-z0-9._+-]/g,'').slice(0,128);
}

export async function createMailbox(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(!workspace) redirect(`/app/${tenantSlug}/mail`);

  const domainId=String(formData.get('domainId')||'');
  const localPart=cleanLocalPart(String(formData.get('localPart')||''));
  const displayName=String(formData.get('displayName')||'').trim().slice(0,255);
  const requestedType=String(formData.get('type')||'personal');
  const type=['personal','shared','alias'].includes(requestedType)?requestedType:'personal';
  const forwardingAddress=String(formData.get('forwardingAddress')||'').trim().toLowerCase();
  const catchAll=String(formData.get('catchAll')||'')==='yes';

  if(!localPart||!/^[a-z0-9](?:[a-z0-9._+-]{0,126}[a-z0-9])?$/.test(localPart)){
    redirect(`/app/${tenantSlug}/mail/mailboxes?error=address`);
  }
  if(forwardingAddress&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardingAddress)){
    redirect(`/app/${tenantSlug}/mail/mailboxes?error=forward`);
  }
  if(type==='alias'&&!forwardingAddress){
    redirect(`/app/${tenantSlug}/mail/mailboxes?error=forward`);
  }

  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.id,domainId),eq(mailDomains.tenantId,tenant.id)),
  });
  if(!domain) redirect(`/app/${tenantSlug}/mail/mailboxes?error=domain`);

  const planKey=await resolveTenantMailPlanKey(tenant.id,workspace.planKey,tenant.slug);
  const limits=await resolveTenantMailPlanLimits(tenant.id,planKey);
  if(limits && type!=='alias'){
    const [mailboxCount]=await db.select({value:count()}).from(mailMailboxes).where(and(
      eq(mailMailboxes.tenantId,tenant.id),ne(mailMailboxes.type,'alias'),
    ));
    if(Number(mailboxCount?.value??0)>=limits.mailboxes) redirect(`/app/${tenantSlug}/mail/mailboxes?error=plan-limit`);
  }
  if(limits && type==='shared'){
    const [sharedCount]=await db.select({value:count()}).from(mailMailboxes).where(and(
      eq(mailMailboxes.tenantId,tenant.id),eq(mailMailboxes.type,'shared'),
    ));
    if(Number(sharedCount?.value??0)>=limits.sharedInboxes) redirect(`/app/${tenantSlug}/mail/mailboxes?error=plan-limit`);
  }
  if(limits && !(await canAssignMailTeamSeat(tenant.id,actor.userId,limits.teamSeats))){
    redirect(`/app/${tenantSlug}/mail/mailboxes?error=plan-limit`);
  }

  if(catchAll){
    await db.update(mailMailboxes).set({catchAll:false,updatedAt:new Date()}).where(and(eq(mailMailboxes.tenantId,tenant.id),eq(mailMailboxes.domainId,domain.id),eq(mailMailboxes.catchAll,true)));
  }

  const [mailbox]=await db.insert(mailMailboxes).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domainId:domain.id,
    localPart,
    displayName:displayName||null,
    type,
    forwardingAddress:forwardingAddress||null,
    catchAll,
    createdByUserId:actor.userId,
  }).onConflictDoNothing({target:[mailMailboxes.domainId,mailMailboxes.localPart]}).returning();

  if(mailbox){
    if(domain.routingEnabled&&domain.cloudflareZoneId){
      try{
        if(catchAll) await setCloudflareEmailCatchAll(domain.cloudflareZoneId);
        else await createCloudflareEmailWorkerRule(domain.cloudflareZoneId,`${localPart}@${domain.domain}`);
      }catch{
        await db.update(mailMailboxes).set({status:'routing_pending',updatedAt:new Date()}).where(eq(mailMailboxes.id,mailbox.id));
      }
    }
    await db.insert(mailMailboxMembers).values({
      tenantId:tenant.id,
      mailboxId:mailbox.id,
      userId:actor.userId,
      role:'owner',
    }).onConflictDoNothing();
    await db.update(mailWorkspaces).set({onboardingStep:'ready',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspace.id));
  }

  revalidatePath(`/app/${tenantSlug}/mail`);
  revalidatePath(`/app/${tenantSlug}/mail/mailboxes`);
  redirect(`/app/${tenantSlug}/mail/mailboxes`);
}
