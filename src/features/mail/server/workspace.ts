import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailWorkspaces, tenantMemberships } from '@/shared/db/schema';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function getMailWorkspace(tenantSlug:string){
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) return null;
  return db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
}

export async function requireMailWorkspaceAccess(tenantSlug:string){
  const actor=await requireTenantMembership(tenantSlug);
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) throw new Error('Tenant not found');
  const membership=await db.query.tenantMemberships.findFirst({
    where:and(eq(tenantMemberships.tenantId,tenant.id),eq(tenantMemberships.userId,actor.userId)),
    columns:{role:true},
  });
  if(!membership) throw new Error('Membership not found');
  return {actor,tenant,membership};
}

export async function enableMailWorkspace(tenantSlug:string){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const existing=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(existing) return existing;
  const [created]=await db.insert(mailWorkspaces).values({
    tenantId:tenant.id,
    status:'active',
    planKey:'starter',
    onboardingStep:'domain',
    enabledByUserId:actor.userId,
  }).onConflictDoNothing({target:mailWorkspaces.tenantId}).returning();
  if(created) return created;
  return db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
}
