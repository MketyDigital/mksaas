import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export type ProjectAccessResult = Awaited<ReturnType<typeof requireProjectAccess>>;

export async function requireProjectAccess({ tenantSlug, projectSlug }: { tenantSlug: string; projectSlug: string }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return { status: 'not-found' as const, reason: 'Workspace not found.' };
  }

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });

  if (!membership) {
    return { status: 'forbidden' as const, reason: 'Forbidden.' };
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)),
  });

  if (!project) {
    return { status: 'not-found' as const, reason: 'Project not found.' };
  }

  return {
    status: 'ok' as const,
    session,
    tenant,
    membership,
    project,
    canManage: membership.role === 'admin' || membership.role === 'manager',
  };
}
