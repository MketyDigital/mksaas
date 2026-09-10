import { z } from 'zod';

const safeHrefSchema = z
  .string()
  .min(1)
  .refine((href) => href.startsWith('/') || href.startsWith('#') || href.startsWith('https://') || href.startsWith('mailto:'), {
    message: 'Href must be a relative path, anchor, HTTPS URL, or mailto link.',
  });

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex value.');

export const ctaSchema = z.object({
  label: z.string().min(1).max(120),
  href: safeHrefSchema,
});

export const siteSettingsSchema = z.object({
  brandName: z.string().min(1).max(120).default('Mkety'),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  primaryColor: hexColorSchema.default('#6D5DF6'),
  secondaryColor: hexColorSchema.default('#A855F7'),
  accentColor: hexColorSchema.default('#22D3EE'),
  defaultSeoTitle: z.string().min(1).max(160),
  defaultSeoDescription: z.string().min(1).max(320),
  socialImageUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactHref: safeHrefSchema.optional(),
  legalLinks: z.array(ctaSchema).default([]),
});

export const navigationItemSchema = z.object({
  label: z.string().min(1).max(120),
  href: safeHrefSchema,
  area: z.enum(['header', 'footer']),
  sortOrder: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
  external: z.boolean().default(false),
});

export const heroSectionSchema = z.object({
  badge: z.string().min(1).max(120),
  headline: z.string().min(1).max(180),
  subheadline: z.string().min(1).max(420),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  previewItems: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        description: z.string().min(1).max(220),
      }),
    )
    .default([]),
});

export const contentCardSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(420),
  href: safeHrefSchema.optional(),
  badge: z.string().max(80).optional(),
});

export const workspaceSectionSchema = z.object({
  eyebrow: z.string().min(1).max(80),
  title: z.string().min(1).max(180),
  description: z.string().max(420).optional(),
  items: z.array(contentCardSchema).min(1),
});

const publicSectionCardSchema = z
  .object({
    key: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    description: z.string().min(1).max(420),
    href: safeHrefSchema.optional(),
    badge: z.string().max(80).optional(),
  })
  .strict();

const publicContentSectionShape = {
  eyebrow: z.string().min(1).max(80),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(700),
  items: z.array(publicSectionCardSchema).default([]),
  cta: ctaSchema.optional(),
};

export const platformOverviewSectionSchema = z.object(publicContentSectionShape).strict();
export const solutionHubSectionSchema = z.object(publicContentSectionShape).strict();
export const academySectionSchema = z.object(publicContentSectionShape).strict();
export const enterpriseSectionSchema = z.object(publicContentSectionShape).strict();
export const trustSectionSchema = z.object(publicContentSectionShape).strict();

export const pricingPlanSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  priceLabel: z.string().min(1).max(120),
  billingLabel: z.string().max(120).optional(),
  description: z.string().min(1).max(420),
  highlighted: z.boolean().default(false),
  ctaLabel: z.string().min(1).max(120),
  ctaHref: safeHrefSchema,
  features: z.array(z.string().min(1).max(180)).min(1),
});

export const faqItemSchema = z.object({
  question: z.string().min(1).max(180),
  answer: z.string().min(1).max(1000),
});

export const footerGroupSchema = z.object({
  title: z.string().min(1).max(120),
  links: z.array(ctaSchema).min(1),
});

export const docsCategorySchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(180),
  description: z.string().max(420).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const docsArticleSchema = z.object({
  categoryKey: z.string().min(1).max(100),
  slug: z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(220),
  excerpt: z.string().max(420).optional(),
  bodyMarkdown: z.string().min(1),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export type PlatformCta = z.infer<typeof ctaSchema>;
export type PlatformSiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type PlatformNavigationItemInput = z.infer<typeof navigationItemSchema>;
export type PlatformHeroSectionInput = z.infer<typeof heroSectionSchema>;
export type PlatformContentCardInput = z.infer<typeof contentCardSchema>;
export type PlatformWorkspaceSectionInput = z.infer<typeof workspaceSectionSchema>;
export type PlatformOverviewSectionInput = z.infer<typeof platformOverviewSectionSchema>;
export type PlatformSolutionHubSectionInput = z.infer<typeof solutionHubSectionSchema>;
export type PlatformAcademySectionInput = z.infer<typeof academySectionSchema>;
export type PlatformEnterpriseSectionInput = z.infer<typeof enterpriseSectionSchema>;
export type PlatformTrustSectionInput = z.infer<typeof trustSectionSchema>;
export type PlatformPricingPlanInput = z.infer<typeof pricingPlanSchema>;
export type PlatformFaqItemInput = z.infer<typeof faqItemSchema>;
export type PlatformFooterGroupInput = z.infer<typeof footerGroupSchema>;
export type PlatformDocsCategoryInput = z.infer<typeof docsCategorySchema>;
export type PlatformDocsArticleInput = z.infer<typeof docsArticleSchema>;
