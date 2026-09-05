import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';

export const platformContentStatusEnum = appSchema.enum('platform_content_status', ['draft', 'published', 'archived']);
export const platformNavigationAreaEnum = appSchema.enum('platform_navigation_area', ['header', 'footer']);
export const platformContentEntityEnum = appSchema.enum('platform_content_entity', [
  'site_settings',
  'page',
  'page_section',
  'navigation_item',
  'pricing_plan',
  'pricing_feature',
  'docs_category',
  'docs_article',
]);
export const platformContentActionEnum = appSchema.enum('platform_content_action', [
  'create',
  'update',
  'publish',
  'unpublish',
  'archive',
  'delete',
]);

export const platformSiteSettings = appSchema.table('platform_site_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  environment: varchar('environment', { length: 40 }).notNull().default('production'),
  status: platformContentStatusEnum('status').notNull().default('draft'),
  brandName: varchar('brand_name', { length: 120 }).notNull().default('Mkety'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#6D5DF6'),
  secondaryColor: varchar('secondary_color', { length: 7 }).notNull().default('#A855F7'),
  accentColor: varchar('accent_color', { length: 7 }).notNull().default('#22D3EE'),
  defaultSeoTitle: varchar('default_seo_title', { length: 160 }).notNull().default('Mkety'),
  defaultSeoDescription: text('default_seo_description'),
  socialImageUrl: text('social_image_url'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactHref: text('contact_href'),
  legalLinksJson: jsonb('legal_links_json').$type<Array<{ label: string; href: string }>>().notNull().default([]),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const platformPages = appSchema.table(
  'platform_pages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    seoTitle: varchar('seo_title', { length: 160 }),
    seoDescription: text('seo_description'),
    enabled: boolean('enabled').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('platform_pages_slug_idx').on(table.slug), index('platform_pages_status_idx').on(table.status)],
);

export const platformPageSections = appSchema.table(
  'platform_page_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => platformPages.id, { onDelete: 'cascade' }),
    sectionKey: varchar('section_key', { length: 120 }).notNull(),
    sectionType: varchar('section_type', { length: 80 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    contentJson: jsonb('content_json').$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_page_sections_page_key_idx').on(table.pageId, table.sectionKey),
    index('platform_page_sections_page_sort_idx').on(table.pageId, table.sortOrder),
    index('platform_page_sections_status_idx').on(table.status),
  ],
);

export const platformNavigationItems = appSchema.table(
  'platform_navigation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    area: platformNavigationAreaEnum('area').notNull(),
    parentId: uuid('parent_id'),
    label: varchar('label', { length: 120 }).notNull(),
    href: text('href').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    external: boolean('external').notNull().default(false),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('platform_navigation_items_area_sort_idx').on(table.area, table.sortOrder),
    index('platform_navigation_items_parent_idx').on(table.parentId),
    index('platform_navigation_items_status_idx').on(table.status),
  ],
);

export const platformPricingPlans = appSchema.table(
  'platform_pricing_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    priceLabel: varchar('price_label', { length: 120 }).notNull(),
    billingLabel: varchar('billing_label', { length: 120 }),
    description: text('description').notNull(),
    highlighted: boolean('highlighted').notNull().default(false),
    ctaLabel: varchar('cta_label', { length: 120 }).notNull(),
    ctaHref: text('cta_href').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('platform_pricing_plans_key_idx').on(table.key), index('platform_pricing_plans_status_idx').on(table.status)],
);

export const platformPricingFeatures = appSchema.table(
  'platform_pricing_features',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => platformPricingPlans.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('platform_pricing_features_plan_sort_idx').on(table.planId, table.sortOrder)],
);

export const platformDocsCategories = appSchema.table(
  'platform_docs_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('platform_docs_categories_key_idx').on(table.key), index('platform_docs_categories_sort_idx').on(table.sortOrder)],
);

export const platformDocsArticles = appSchema.table(
  'platform_docs_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => platformDocsCategories.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 180 }).notNull(),
    title: varchar('title', { length: 220 }).notNull(),
    excerpt: text('excerpt'),
    bodyMarkdown: text('body_markdown').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: platformContentStatusEnum('status').notNull().default('draft'),
    seoTitle: varchar('seo_title', { length: 160 }),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_docs_articles_category_slug_idx').on(table.categoryId, table.slug),
    index('platform_docs_articles_status_idx').on(table.status),
    index('platform_docs_articles_sort_idx').on(table.categoryId, table.sortOrder),
  ],
);

export const platformContentRevisions = appSchema.table(
  'platform_content_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: platformContentEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: platformContentActionEnum('action').notNull(),
    beforeJson: jsonb('before_json').$type<Record<string, unknown> | null>(),
    afterJson: jsonb('after_json').$type<Record<string, unknown> | null>(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('platform_content_revisions_entity_idx').on(table.entityType, table.entityId), index('platform_content_revisions_actor_idx').on(table.actorId)],
);

export const platformSiteSettingsRelations = relations(platformSiteSettings, ({ one }) => ({
  creator: one(users, {
    fields: [platformSiteSettings.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformSiteSettings.updatedBy],
    references: [users.id],
  }),
}));

export const platformPagesRelations = relations(platformPages, ({ many, one }) => ({
  sections: many(platformPageSections),
  creator: one(users, {
    fields: [platformPages.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformPages.updatedBy],
    references: [users.id],
  }),
}));

export const platformPageSectionsRelations = relations(platformPageSections, ({ one }) => ({
  page: one(platformPages, {
    fields: [platformPageSections.pageId],
    references: [platformPages.id],
  }),
  creator: one(users, {
    fields: [platformPageSections.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformPageSections.updatedBy],
    references: [users.id],
  }),
}));

export const platformPricingPlansRelations = relations(platformPricingPlans, ({ many, one }) => ({
  features: many(platformPricingFeatures),
  creator: one(users, {
    fields: [platformPricingPlans.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformPricingPlans.updatedBy],
    references: [users.id],
  }),
}));

export const platformPricingFeaturesRelations = relations(platformPricingFeatures, ({ one }) => ({
  plan: one(platformPricingPlans, {
    fields: [platformPricingFeatures.planId],
    references: [platformPricingPlans.id],
  }),
}));

export const platformDocsCategoriesRelations = relations(platformDocsCategories, ({ many, one }) => ({
  articles: many(platformDocsArticles),
  creator: one(users, {
    fields: [platformDocsCategories.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformDocsCategories.updatedBy],
    references: [users.id],
  }),
}));

export const platformDocsArticlesRelations = relations(platformDocsArticles, ({ one }) => ({
  category: one(platformDocsCategories, {
    fields: [platformDocsArticles.categoryId],
    references: [platformDocsCategories.id],
  }),
  creator: one(users, {
    fields: [platformDocsArticles.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformDocsArticles.updatedBy],
    references: [users.id],
  }),
}));

export const platformContentRevisionsRelations = relations(platformContentRevisions, ({ one }) => ({
  actor: one(users, {
    fields: [platformContentRevisions.actorId],
    references: [users.id],
  }),
}));

export type PlatformSiteSettings = typeof platformSiteSettings.$inferSelect;
export type NewPlatformSiteSettings = typeof platformSiteSettings.$inferInsert;
export type PlatformPage = typeof platformPages.$inferSelect;
export type NewPlatformPage = typeof platformPages.$inferInsert;
export type PlatformPageSection = typeof platformPageSections.$inferSelect;
export type NewPlatformPageSection = typeof platformPageSections.$inferInsert;
export type PlatformNavigationItem = typeof platformNavigationItems.$inferSelect;
export type NewPlatformNavigationItem = typeof platformNavigationItems.$inferInsert;
export type PlatformPricingPlan = typeof platformPricingPlans.$inferSelect;
export type NewPlatformPricingPlan = typeof platformPricingPlans.$inferInsert;
export type PlatformPricingFeature = typeof platformPricingFeatures.$inferSelect;
export type NewPlatformPricingFeature = typeof platformPricingFeatures.$inferInsert;
export type PlatformDocsCategory = typeof platformDocsCategories.$inferSelect;
export type NewPlatformDocsCategory = typeof platformDocsCategories.$inferInsert;
export type PlatformDocsArticle = typeof platformDocsArticles.$inferSelect;
export type NewPlatformDocsArticle = typeof platformDocsArticles.$inferInsert;
export type PlatformContentRevision = typeof platformContentRevisions.$inferSelect;
export type NewPlatformContentRevision = typeof platformContentRevisions.$inferInsert;
