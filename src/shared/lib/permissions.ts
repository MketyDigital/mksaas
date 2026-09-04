import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import type { Role } from '@/shared/db/schema/roles';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

async function getEffectivePermissionKeys(tenantSlug: string, userId: string): Promise<Set<string>> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return new Set();

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.userId, userId)),
    columns: { id: true, role: true },
  });
  if (!membership) return new Set();

  // The membership role is the authoritative baseline for the built-in admin role.
  // PBAC role rows remain available for custom roles and future granular permissions.
  if (membership.role === 'admin') return new Set(['*']);

  const membershipRoles = await db.query.tenantMembershipRoles.findMany({ where: eq(schema.tenantMembershipRoles.membershipId, membership.id), columns: { roleId: true } });
  const roleIds = membershipRoles.map((r) => r.roleId);
  if (roleIds.length === 0) return new Set();

  const rp = await db.query.rolePermissions.findMany({ where: inArray(schema.rolePermissions.roleId, roleIds), columns: { permissionId: true } });
  const permissionIds = [...new Set(rp.map((r) => r.permissionId))];
  if (permissionIds.length === 0) return new Set();

  const perms = await db.query.permissions.findMany({
    where: and(inArray(schema.permissions.id, permissionIds), or(eq(schema.permissions.tenantId, tenant.id), isNull(schema.permissions.tenantId))),
    columns: { key: true },
  });
  return new Set(perms.map((p) => p.key));
}

export async function getAllTenantPermissionsForUser(userId: string): Promise<Record<string, string[]>> {
  const memberships = await db.query.tenantMemberships.findMany({
    where: eq(schema.tenantMemberships.userId, userId),
    columns: { id: true, role: true },
    with: { tenant: { columns: { slug: true, id: true } } },
  });
  if (memberships.length === 0) return {};

  // Keep a concrete string[] value for every tenant so TypeScript does not infer
  // a nullable Map value for non-admin memberships.
  const adminResults = new Map<string, string[]>(memberships.map((m) => [m.tenant.slug, m.role === 'admin' ? ['*'] : []]));
  const nonAdmin = memberships.filter((m) => m.role !== 'admin');
  if (nonAdmin.length === 0) return Object.fromEntries(adminResults);

  const membershipIds = nonAdmin.map((m) => m.id);
  const tenantIds = [...new Set(nonAdmin.map((m) => m.tenant.id))];
  const membershipRoles = await db.query.tenantMembershipRoles.findMany({ where: inArray(schema.tenantMembershipRoles.membershipId, membershipIds), columns: { membershipId: true, roleId: true } });
  const roleIdsByMembershipId = new Map<string, string[]>();
  for (const row of membershipRoles) roleIdsByMembershipId.set(row.membershipId, [...(roleIdsByMembershipId.get(row.membershipId) ?? []), row.roleId]);
  const allRoleIds = [...new Set(membershipRoles.map((r) => r.roleId))];
  if (allRoleIds.length === 0) return Object.fromEntries(memberships.map((m) => [m.tenant.slug, adminResults.get(m.tenant.slug) ?? []]));

  const rpRows = await db.query.rolePermissions.findMany({ where: inArray(schema.rolePermissions.roleId, allRoleIds), columns: { roleId: true, permissionId: true } });
  const permissionIdsByRoleId = new Map<string, string[]>();
  for (const row of rpRows) permissionIdsByRoleId.set(row.roleId, [...(permissionIdsByRoleId.get(row.roleId) ?? []), row.permissionId]);
  const allPermissionIds = [...new Set(rpRows.map((r) => r.permissionId))];
  if (allPermissionIds.length === 0) return Object.fromEntries(memberships.map((m) => [m.tenant.slug, adminResults.get(m.tenant.slug) ?? []]));

  const permsRows = await db.query.permissions.findMany({
    where: and(inArray(schema.permissions.id, allPermissionIds), or(inArray(schema.permissions.tenantId, tenantIds), isNull(schema.permissions.tenantId))),
    columns: { id: true, key: true, tenantId: true },
  });
  const permKeyById = new Map(permsRows.map((p) => [p.id, p.key]));
  const permTenantById = new Map(permsRows.map((p) => [p.id, p.tenantId]));
  const result: Record<string, string[]> = {};

  for (const m of memberships) {
    if (m.role === 'admin') { result[m.tenant.slug] = ['*']; continue; }
    const keys = new Set<string>();
    for (const roleId of roleIdsByMembershipId.get(m.id) ?? []) {
      for (const pid of permissionIdsByRoleId.get(roleId) ?? []) {
        const key = permKeyById.get(pid);
        const permTenantId = permTenantById.get(pid);
        if (key && (permTenantId === null || permTenantId === m.tenant.id)) keys.add(key);
      }
    }
    result[m.tenant.slug] = [...keys];
  }
  return result;
}

export async function hasPermission(tenantSlug: string, permissionKey: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const keys = await getEffectivePermissionKeys(tenantSlug, session.user.id);
  return keys.has('*') || keys.has(permissionKey);
}

export async function requirePermission(tenantSlug: string, permissionKey: string): Promise<{ userId: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) redirect('/login');
  if (!(await hasPermission(tenantSlug, permissionKey))) redirect(`/t/${tenantSlug}?error=unauthorized`);
  return { userId: session.user.id, email: session.user.email };
}

export async function getCurrentRoleIds(tenantSlug: string): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return [];
  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.userId, session.user.id)), columns: { id: true } });
  if (!membership) return [];
  const rows = await db.query.tenantMembershipRoles.findMany({ where: eq(schema.tenantMembershipRoles.membershipId, membership.id), columns: { roleId: true } });
  return rows.map((r) => r.roleId);
}

export async function getCurrentRoles(tenantSlug: string): Promise<Role[]> {
  const roleIds = await getCurrentRoleIds(tenantSlug);
  if (roleIds.length === 0) return [];
  return (await db.query.roles.findMany({ where: inArray(schema.roles.id, roleIds) })) as Role[];
}

export async function getCurrentUserPermissions(tenantSlug: string): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return [...(await getEffectivePermissionKeys(tenantSlug, session.user.id))];
}
