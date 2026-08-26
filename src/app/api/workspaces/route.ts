import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? ((await request.json().catch(() => ({}))) as { name?: string; slug?: string; description?: string })
    : Object.fromEntries(await request.formData()) as { name?: string; slug?: string; description?: string };

  const name = String(body.name || '').trim();
  const slug = slugify(String(body.slug || name));
  const description = String(body.description || '').trim();

  if (!name || !slug) return NextResponse.json({ success: false, error: 'Workspace name and slug are required.' }, { status: 400 });

  const existing = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
  if (existing) return NextResponse.json({ success: false, error: 'That workspace slug is already in use.' }, { status: 409 });

  const tenant = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.tenants).values({ name, slug, description: description || null }).returning();
    await tx.insert(schema.tenantMemberships).values({ tenantId: created.id, userId: session.user.id, role: 'admin' });
    return created;
  });

  if (!contentType.includes('application/json')) return NextResponse.redirect(new URL(`/t/${tenant.slug}`, request.url));
  return NextResponse.json({ success: true, data: tenant, redirectTo: `/t/${tenant.slug}` });
}
