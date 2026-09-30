import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformEditorialDrafts, type PlatformJson } from '@/shared/db/schema/platform-content';

import type { PlatformContentArea, PlatformContentEntityType } from './action-schemas';
import { requirePlatformAppExperienceAccess, requirePlatformContentAccess } from './authorization';

type EditorialKey = { area: PlatformContentArea; entityType: PlatformContentEntityType; entityKey: string };

function matches(key: EditorialKey) {
  return and(
    eq(platformEditorialDrafts.area, key.area),
    eq(platformEditorialDrafts.entityType, key.entityType),
    eq(platformEditorialDrafts.entityKey, key.entityKey),
  );
}

export async function getEditorialDraft(tenantSlug: string, key: EditorialKey): Promise<Record<string, unknown> | null> {
  if (key.area === 'app-experience') await requirePlatformAppExperienceAccess(tenantSlug);
  else await requirePlatformContentAccess(tenantSlug);
  const row = await db.query.platformEditorialDrafts.findFirst({ where: matches(key) });
  return (row?.payloadJson as Record<string, unknown>) ?? null;
}

export async function stageEditorialDraft(key: EditorialKey, payload: Record<string, unknown>, actorId: string) {
  await db.insert(platformEditorialDrafts).values({
    ...key,
    payloadJson: JSON.parse(JSON.stringify(payload)) as PlatformJson,
    updatedBy: actorId,
  }).onConflictDoUpdate({
    target: [platformEditorialDrafts.area, platformEditorialDrafts.entityType, platformEditorialDrafts.entityKey],
    set: { payloadJson: JSON.parse(JSON.stringify(payload)) as PlatformJson, updatedBy: actorId, updatedAt: new Date() },
  });
}

export async function readEditorialDraft(key: EditorialKey): Promise<Record<string, unknown> | null> {
  const row = await db.query.platformEditorialDrafts.findFirst({ where: matches(key) });
  return (row?.payloadJson as Record<string, unknown>) ?? null;
}

export async function removeEditorialDraft(key: EditorialKey) {
  await db.delete(platformEditorialDrafts).where(matches(key));
}
