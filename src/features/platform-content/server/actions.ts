'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requirePlatformAppExperienceAccess, requirePlatformContentAccess } from './authorization';

export const platformContentAreaSchema = z.enum(['public-site', 'docs', 'pricing', 'navigation', 'settings', 'app-experience']);
export const platformContentEntitySchema = z.enum([
  'site_settings',
  'page',
  'page_section',
  'navigation_item',
  'pricing_plan',
  'pricing_feature',
  'docs_category',
  'docs_article',
  'app_experience',
]);

export const platformContentDraftActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
  payload: z.record(z.string(), z.unknown()),
});

export const platformPublishActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
});

export type PlatformContentDraftActionInput = z.infer<typeof platformContentDraftActionSchema>;
export type PlatformPublishActionInput = z.infer<typeof platformPublishActionSchema>;

async function requireAreaAccess(tenantSlug: string, area: z.infer<typeof platformContentAreaSchema>) {
  if (area === 'app-experience') {
    return requirePlatformAppExperienceAccess(tenantSlug);
  }

  return requirePlatformContentAccess(tenantSlug);
}

export async function savePlatformContentDraft(tenantSlug: string, input: PlatformContentDraftActionInput) {
  const parsed = platformContentDraftActionSchema.parse(input);
  const actor = await requireAreaAccess(tenantSlug, parsed.area);

  // Database writes are intentionally deferred until migration reconciliation is verified.
  // This function establishes the server-only authorization and validation boundary that UI forms will call.
  revalidatePath('/');
  revalidatePath('/docs');
  revalidatePath(`/t/${tenantSlug}/admin/platform-control`);

  return {
    ok: true,
    status: 'validated' as const,
    actorEmail: actor.email,
    area: parsed.area,
    entityType: parsed.entityType,
    entityKey: parsed.entityKey,
  };
}

export async function publishPlatformContent(tenantSlug: string, input: PlatformPublishActionInput) {
  const parsed = platformPublishActionSchema.parse(input);
  const actor = await requireAreaAccess(tenantSlug, parsed.area);

  // Publishing will become a transactional DB update plus revision/audit event after migration verification.
  revalidatePath('/');
  revalidatePath('/docs');
  revalidatePath(`/t/${tenantSlug}/admin/platform-control`);

  return {
    ok: true,
    status: 'validated' as const,
    actorEmail: actor.email,
    area: parsed.area,
    entityType: parsed.entityType,
    entityKey: parsed.entityKey,
  };
}
