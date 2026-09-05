import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import { getTenantBySlug } from '@/shared/lib/tenant';

import type { PlatformContentDraftActionInput, PlatformPublishActionInput } from './action-schemas';

type PlatformContentAuditInput = {
  tenantSlug: string;
  actorUserId: string;
  actorEmail: string;
  action: 'platform_content.draft_saved' | 'platform_content.published';
  input: PlatformContentDraftActionInput | PlatformPublishActionInput;
  mutatedRecords: number;
};

export async function recordPlatformContentAuditEvent(input: PlatformContentAuditInput) {
  const tenant = await getTenantBySlug(input.tenantSlug);

  await db.insert(schema.auditEvents).values({
    tenantId: tenant?.id ?? null,
    actorId: null,
    action: input.action,
    entityType: input.input.entityType,
    changes: {
      area: input.input.area,
      entityType: input.input.entityType,
      entityKey: input.input.entityKey,
      mutatedRecords: input.mutatedRecords,
    },
    metadata: {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      source: 'mkety_platform_control_center',
      note: 'Auth user id is stored in metadata because audit_events.actor_id references persons.id.',
    },
  });
}
