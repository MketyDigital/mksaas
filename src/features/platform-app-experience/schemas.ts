import { z } from 'zod';

const safeHrefSchema = z
  .string()
  .min(1)
  .refine((href) => href.startsWith('/') || href.startsWith('#') || href.startsWith('https://') || href.startsWith('mailto:'), {
    message: 'Href must be a relative path, anchor, HTTPS URL, or mailto link.',
  });

const ctaSchema = z.object({
  label: z.string().min(1).max(120),
  href: safeHrefSchema,
});

export const appDashboardSettingsSchema = z.object({
  headline: z.string().min(1).max(180),
  description: z.string().min(1).max(420),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema.optional(),
  support: ctaSchema.optional(),
});

export const workspaceCardSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().min(1).max(420),
  href: safeHrefSchema,
  iconKey: z.string().max(80).optional(),
  badgeLabel: z.string().max(80).optional(),
  enabled: z.boolean().default(true),
  requiresEntitlement: z.string().max(120).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const appControlCenterModuleSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(140),
  description: z.string().min(1).max(420),
  href: safeHrefSchema,
  iconKey: z.string().max(80).optional(),
  level: z.number().int().min(1).max(4),
  enabled: z.boolean().default(true),
  requiredPermission: z.string().min(1).max(160),
  sortOrder: z.number().int().min(0).default(0),
});

export const appExperienceDefaultsSchema = z.object({
  dashboard: appDashboardSettingsSchema,
  workspaces: z.array(workspaceCardSchema).min(1),
  controlCenterModules: z.array(appControlCenterModuleSchema).min(1),
});

export type AppDashboardSettingsInput = z.infer<typeof appDashboardSettingsSchema>;
export type WorkspaceCardInput = z.infer<typeof workspaceCardSchema>;
export type AppControlCenterModuleInput = z.infer<typeof appControlCenterModuleSchema>;
export type AppExperienceDefaultsInput = z.infer<typeof appExperienceDefaultsSchema>;
