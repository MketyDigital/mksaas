import { and, eq } from 'drizzle-orm';

import { requireEntitlement } from '@/features/entitlements/server/authorization';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db/cloudflare';
import { mailWorkspaces, tenantMemberships } from '@/shared/db/schema';
import { requirePermission, requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

import { resolveTenantMailPlanKey } from './commercial';
import { getMailWorkspaceAccessMode } from './mail-access-policy';
import { getFirstPartyMailTenantId } from './runtime-config';

export async function getMailWorkspace(tenantSlug:string){
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) return null;
  return db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
}

export async function requireMailWorkspaceAccess(tenantSlug:string){
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) throw new Error('Tenant not found');
  const reservedTenantId=getFirstPartyMailTenantId().trim();
  if(getMailWorkspaceAccessMode(tenant.id,reservedTenantId)==='platform-operator'){
    const opsTenantSlug=process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG?.trim()||'';
    const actor=await requirePlatformControlAccess(opsTenantSlug);
    await requirePermission(opsTenantSlug,'platform:plans');
    await requireEntitlement({ tenantId: tenant.id, entitlement: 'workspace.mail' });
    return {actor,tenant,membership:{role:'admin'},platformOperator:true as const};
  }
  const actor=await requireTenantMembership(tenantSlug);
  await requireEntitlement({ tenantId: tenant.id, entitlement: 'workspace.mail' });
  const membership=await db.query.tenantMemberships.findFirst({
    where:and(eq(tenantMemberships.tenantId,tenant.id),eq(tenantMemberships.userId,actor.userId)),
    columns:{role:true},
  });
  if(!membership) throw new Error('Membership not found');
  return {actor,tenant,membership,platformOperator:false as const};
}

export async function enableMailWorkspace(tenantSlug:string){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const existing=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(existing) return existing;
  const planKey=await resolveTenantMailPlanKey(tenant.id);
  const [created]=await db.insert(mailWorkspaces).values({
    tenantId:tenant.id,
    status:'active',
    planKey,
    onboardingStep:'domain',
    enabledByUserId:actor.userId,
  }).onConflictDoNothing({target:mailWorkspaces.tenantId}).returning();
  if(created) return created;
  return db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
}
