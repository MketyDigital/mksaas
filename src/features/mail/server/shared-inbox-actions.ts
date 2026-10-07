'use server';

import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailMailboxMembers, mailThreadNotes, mailThreads, mailWorkspaces, tenantMemberships } from '@/shared/db/schema';

import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';
import { canAssignMailTeamSeat } from './mail-team-seats';
import { requireMailWorkspaceAccess } from './workspace';

export async function updateSharedThread(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const threadId=String(formData.get('threadId')||'');
  const status=String(formData.get('status')||'');
  const assignedUserId=String(formData.get('assignedUserId')||'');
  let seatLimit:number|null=null;
  if(assignedUserId){
    const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
    if(!workspace) return;
    const planKey=await resolveTenantMailPlanKey(tenant.id,workspace.planKey,tenant.slug);
    const limits=await resolveTenantMailPlanLimits(tenant.id,planKey);
    seatLimit=limits?.teamSeats??null;
  }

  let seatLimitExceeded=false;
  await db.transaction(async(tx)=>{
    // Serialize every seat-affecting mutation for this tenant before counting.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenant.id}, 0))`);
    const [thread]=await tx.select().from(mailThreads).where(and(
      eq(mailThreads.id,threadId),
      eq(mailThreads.tenantId,tenant.id),
    )).for('update').limit(1);
    if(!thread) return;

    let assignee:string|null=null;
    if(assignedUserId){
      const [member]=await tx.select({userId:tenantMemberships.userId}).from(tenantMemberships).where(and(
        eq(tenantMemberships.tenantId,tenant.id),
        eq(tenantMemberships.userId,assignedUserId),
      )).limit(1);
      if(member) assignee=assignedUserId;
    }

    if(assignee && assignee!==thread.assignedUserId && seatLimit!==null){
      const members=await tx.select({userId:mailMailboxMembers.userId})
        .from(mailMailboxMembers).where(eq(mailMailboxMembers.tenantId,tenant.id));
      const assignments=await tx.select({assignedUserId:mailThreads.assignedUserId})
        .from(mailThreads).where(and(
          eq(mailThreads.tenantId,tenant.id),
          isNotNull(mailThreads.assignedUserId),
          ne(mailThreads.id,thread.id),
        ));
      if(!canAssignMailTeamSeat(assignee,seatLimit,members,assignments)){
        seatLimitExceeded=true;
        return;
      }
    }

    await tx.update(mailThreads).set({
      status:['open','pending','resolved'].includes(status)?status:thread.status,
      assignedUserId:assignee,
      updatedAt:new Date(),
    }).where(and(eq(mailThreads.id,threadId),eq(mailThreads.tenantId,tenant.id)));
  });

  if(seatLimitExceeded) redirect(`/app/${tenantSlug}/mail/shared?error=plan-limit`);
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
