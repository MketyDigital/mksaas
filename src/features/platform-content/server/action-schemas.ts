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

const editableAreaByEntity = {
  site_settings: 'settings',
  page_section: 'public-site',
  navigation_item: 'navigation',
  pricing_plan: 'pricing',
  docs_article: 'docs',
  app_experience: 'app-experience',
} as const;

function validEditorialArea(value: { area: string; entityType: string }) {
  return editableAreaByEntity[value.entityType as keyof typeof editableAreaByEntity] === value.area;
}

export const platformContentDraftActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
  payload: z.record(z.string(), z.unknown()),
}).refine(validEditorialArea, { message: 'The editorial entity does not belong to this admin area.' });

export const platformPublishActionSchema = z.object({
  area: platformContentAreaSchema,
  entityType: platformContentEntitySchema,
  entityKey: z.string().min(1).max(180),
}).refine(validEditorialArea, { message: 'The editorial entity does not belong to this admin area.' });

export type PlatformContentArea = z.infer<typeof platformContentAreaSchema>;
export type PlatformContentEntityType = z.infer<typeof platformContentEntitySchema>;
export type PlatformContentDraftActionInput = z.infer<typeof platformContentDraftActionSchema>;
export type PlatformPublishActionInput = z.infer<typeof platformPublishActionSchema>;
