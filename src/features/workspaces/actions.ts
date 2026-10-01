'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { withRequestDatabase } from '@/shared/db/request';
import * as schema from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export async function createWorkspace(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const slug = slugify(String(formData.get('slug') || name));

  if (!name || !slug) throw new Error('Workspace name and slug are required.');

  const tenant = await withRequestDatabase(async (database) => {
    const existing = await database.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
    if (existing) throw new Error('That workspace slug is already in use.');

    return database.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.tenants)
        .values({ name, slug, description: description || null })
        .returning();

      const [adminRole] = await tx.insert(schema.roles).values({
        tenantId: created.id,
        name: 'Admin',
        slug: 'admin',
        description: 'Full workspace administration access',
        isSystem: true,
      }).returning();

      const [membership] = await tx.insert(schema.tenantMemberships).values({
        tenantId: created.id,
        userId: session.user.id,
        role: 'admin',
        primaryRoleId: adminRole.id,
      }).returning();

      await tx.insert(schema.tenantMembershipRoles).values({
        membershipId: membership.id,
        roleId: adminRole.id,
      });

      return created;
    });
  });

  redirect(`/app/${tenant.slug}`);
}
