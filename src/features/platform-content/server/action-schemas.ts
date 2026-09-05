import { z } from 'zod';

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

export type PlatformContentArea = z.infer<typeof platformContentAreaSchema>;
export type PlatformContentEntityType = z.infer<typeof platformContentEntitySchema>;
export type PlatformContentDraftActionInput = z.infer<typeof platformContentDraftActionSchema>;
export type PlatformPublishActionInput = z.infer<typeof platformPublishActionSchema>;
