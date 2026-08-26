'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
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

  const existing = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
  if (existing) throw new Error('That workspace slug is already in use.');

  const tenant = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.tenants)
      .values({ name, slug, description: description || null })
      .returning();

    await tx.insert(schema.tenantMemberships).values({
      tenantId: created.id,
      userId: session.user.id,
      role: 'admin',
    });

    return created;
  });

  redirect(`/t/${tenant.slug}`);
}
