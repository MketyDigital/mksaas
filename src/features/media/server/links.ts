import { desc, eq } from 'drizzle-orm';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db/cloudflare';
import { runPlatformControlMutation } from '@/shared/db/platform-control-mutation';
import { mediaTenantLinks, tenants } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function getMediaTenantLink(tenantId: string) {
  return db.query.mediaTenantLinks.findFirst({
    where: eq(mediaTenantLinks.tenantId, tenantId),
  });
}

export async function listMediaTenantLinks() {
  return db
    .select({
      id: mediaTenantLinks.id,
      tenantId: mediaTenantLinks.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      externalWorkspaceRef: mediaTenantLinks.externalWorkspaceRef,
      status: mediaTenantLinks.status,
      metadata: mediaTenantLinks.metadata,
      linkedAt: mediaTenantLinks.linkedAt,
      disconnectedAt: mediaTenantLinks.disconnectedAt,
      updatedAt: mediaTenantLinks.updatedAt,
    })
    .from(mediaTenantLinks)
    .innerJoin(tenants, eq(mediaTenantLinks.tenantId, tenants.id))
    .orderBy(desc(mediaTenantLinks.updatedAt));
}

async function saveMediaTenantLinkImpl(
  opsTenantSlug: string,
  formData: FormData,
) {
  'use server';
  await requirePlatformControlAccess(opsTenantSlug);
  const actor = await requirePermission(opsTenantSlug, 'platform:plans');
  const targetTenantSlug = String(formData.get('targetTenantSlug') ?? '').trim();
  const externalWorkspaceRef = String(formData.get('externalWorkspaceRef') ?? '').trim().slice(0, 255);
  const requestedStatus = String(formData.get('status') ?? 'linked');
  const status = ['linked', 'suspended', 'disconnected'].includes(requestedStatus)
    ? requestedStatus
    : 'linked';
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);

  if (!targetTenantSlug || !externalWorkspaceRef) {
    throw new Error('Customer workspace and Media workspace reference are required.');
  }

  const target = await getTenantBySlug(targetTenantSlug);
  if (!target) throw new Error('Target Mkety workspace was not found.');

  const now = new Date();
  await db.insert(mediaTenantLinks).values({
    tenantId: target.id,
    externalWorkspaceRef,
    status,
    metadata: note ? { note, verification: 'admin-confirmed' } : { verification: 'admin-confirmed' },
    linkedAt: now,
    disconnectedAt: status === 'disconnected' ? now : null,
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
  }).onConflictDoUpdate({
    target: mediaTenantLinks.tenantId,
    set: {
      externalWorkspaceRef,
      status,
      metadata: note ? { note, verification: 'admin-confirmed' } : { verification: 'admin-confirmed' },
      disconnectedAt: status === 'disconnected' ? now : null,
      updatedByUserId: actor.userId,
      updatedAt: now,
    },
  });
}

export async function saveMediaTenantLink(...args: Parameters<typeof saveMediaTenantLinkImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/t/${tenantSlug}/admin/platform-control/media-connector`,
    action: 'save-media-tenant-link',
    work: () => saveMediaTenantLinkImpl(...args),
  });
}
