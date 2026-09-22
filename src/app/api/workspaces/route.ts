import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { isSelfServiceBillingPlanKey } from '@/features/billing/catalog/self-service-plans';
import { isPlatformControlTenant, isPlatformOperatorEmail } from '@/features/platform-content/server/authorization';
import { withRequestDatabase } from '@/shared/db/request';
import * as schema from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function splitName(name: string | null | undefined, email: string) {
  const fallback = email.split('@')[0] || 'User';
  const parts = (name || fallback).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || 'Admin',
    displayName: name?.trim() || fallback,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? ((await request.json().catch(() => ({}))) as { name?: string; slug?: string; description?: string; plan?: string })
    : (Object.fromEntries(await request.formData()) as { name?: string; slug?: string; description?: string; plan?: string });

  const name = String(body.name || '').trim();
  const slug = slugify(String(body.slug || name));
  const description = String(body.description || '').trim();
  const planKey = body.plan && isSelfServiceBillingPlanKey(String(body.plan)) ? String(body.plan) : null;

  if (!name || !slug) return NextResponse.json({ success: false, error: 'Workspace name and slug are required.' }, { status: 400 });

  if (isPlatformControlTenant(slug) && !isPlatformOperatorEmail(session.user.email)) {
    return NextResponse.json({ success: false, error: 'That workspace address is reserved.' }, { status: 403 });
  }

  const tenant = await withRequestDatabase(async (database) => {
    const existing = await database.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
    if (existing) return null;

    return database.transaction(async (tx) => {
      const [created] = await tx.insert(schema.tenants).values({ name, slug, description: description || null }).returning();
      const personName = splitName(session.user.name, session.user.email!);
      const [person] = await tx.insert(schema.persons).values({
        tenantId: created.id,
        email: session.user.email!,
        firstName: personName.firstName,
        lastName: personName.lastName,
        displayName: personName.displayName,
        avatarUrl: session.user.image || null,
        status: 'active',
        profileInitialized: true,
      }).returning();

      const [membership] = await tx.insert(schema.tenantMemberships).values({
        tenantId: created.id,
        userId: session.user.id,
        personId: person.id,
        role: 'admin',
      }).returning();

      const [adminRole] = await tx.insert(schema.roles).values({
        tenantId: created.id,
        name: 'Admin',
        slug: 'admin',
        description: 'Full workspace administration access',
        isSystem: true,
      }).returning();

      await tx.insert(schema.tenantMembershipRoles).values({ membershipId: membership.id, roleId: adminRole.id });
      return created;
    });
  });

  if (!tenant) return NextResponse.json({ success: false, error: 'That workspace slug is already in use.' }, { status: 409 });

  const redirectTo = planKey
    ? `/t/${tenant.slug}/billing/checkout?plan=${encodeURIComponent(planKey)}`
    : `/t/${tenant.slug}`;

  if (!contentType.includes('application/json')) return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  return NextResponse.json({ success: true, data: tenant, redirectTo });
}
