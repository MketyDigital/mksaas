'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailThreadNotes, mailThreads, mailWorkspaces, tenantMemberships } from '@/shared/db/schema';

import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';
import { canAssignMailTeamSeat } from './mail-team-seats';
import { requireMailWorkspaceAccess } from './workspace';

export async function updateSharedThread(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const threadId=String(formData.get('threadId')||'');
  const status=String(formData.get('status')||'');
  const assignedUserId=String(formData.get('assignedUserId')||'');
  const thread=await db.query.mailThreads.findFirst({where:and(eq(mailThreads.id,threadId),eq(mailThreads.tenantId,tenant.id))});
  if(!thread) return;
  let assignee:string|null=null;
  if(assignedUserId){
    const member=await db.query.tenantMemberships.findFirst({where:and(eq(tenantMemberships.tenantId,tenant.id),eq(tenantMemberships.userId,assignedUserId))});
    if(member){
      const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
      if(!workspace) return;
      const planKey=await resolveTenantMailPlanKey(tenant.id,workspace.planKey,tenant.slug);
      const limits=await resolveTenantMailPlanLimits(tenant.id,planKey);
      if(!(await canAssignMailTeamSeat(tenant.id,assignedUserId,limits?.teamSeats??null,thread.id))){
        redirect(`/app/${tenantSlug}/mail/shared?error=plan-limit`);
      }
      assignee=assignedUserId;
    }
  }
  await db.update(mailThreads).set({
    status:['open','pending','resolved'].includes(status)?status:thread.status,
    assignedUserId:assignee,
    updatedAt:new Date(),
  }).where(and(eq(mailThreads.id,threadId),eq(mailThreads.tenantId,tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/shared`);
}

export async function addSharedThreadNote(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const threadId=String(formData.get('threadId')||'');
  const body=String(formData.get('body')||'').trim().slice(0,5000);
  if(!body) return;
  const thread=await db.query.mailThreads.findFirst({where:and(eq(mailThreads.id,threadId),eq(mailThreads.tenantId,tenant.id))});
  if(!thread) return;
  await db.insert(mailThreadNotes).values({tenantId:tenant.id,threadId,authorUserId:actor.userId,body});
  revalidatePath(`/app/${tenantSlug}/mail/shared`);
}
