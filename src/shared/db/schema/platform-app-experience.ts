import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants';
import { users } from './auth';
import { appSchema } from './schema';

export const platformAppExperienceStatusEnum = appSchema.enum('platform_app_experience_status', [
  'draft',
  'published',
  'archived',
]);

export const platformAppExperienceEntityEnum = appSchema.enum('platform_app_experience_entity', [
  'dashboard_settings',
  'workspace_card',
  'control_center_module',
]);

export const platformAppDashboardSettings = appSchema.table(
  'platform_app_dashboard_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    environment: varchar('environment', { length: 40 }).notNull().default('production'),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    status: platformAppExperienceStatusEnum('status').notNull().default('draft'),
    headline: varchar('headline', { length: 180 }).notNull().default('Welcome to Mkety'),
    description: text('description'),
    primaryCtaLabel: varchar('primary_cta_label', { length: 120 }).notNull().default('Create Project'),
    primaryCtaHref: text('primary_cta_href').notNull().default('/create-workspace'),
    secondaryCtaLabel: varchar('secondary_cta_label', { length: 120 }).default('Explore SolutionHub'),
    secondaryCtaHref: text('secondary_cta_href').default('/app/solutions'),
    supportLabel: varchar('support_label', { length: 120 }).default('Need help?'),
    supportHref: text('support_href').default('/docs'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_app_dashboard_settings_scope_idx').on(table.environment, table.tenantId),
    index('platform_app_dashboard_settings_status_idx').on(table.status),
    index('platform_app_dashboard_settings_tenant_idx').on(table.tenantId),
  ],
);

export const platformWorkspaceCards = appSchema.table(
  'platform_workspace_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    workspaceKey: varchar('workspace_key', { length: 80 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    description: text('description').notNull(),
    href: text('href').notNull(),
    iconKey: varchar('icon_key', { length: 80 }),
    badgeLabel: varchar('badge_label', { length: 80 }),
    enabled: boolean('enabled').notNull().default(true),
    requiresEntitlement: varchar('requires_entitlement', { length: 120 }),
    sortOrder: integer('sort_order').notNull().default(0),
    status: platformAppExperienceStatusEnum('status').notNull().default('draft'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_workspace_cards_scope_key_idx').on(table.tenantId, table.workspaceKey),
    index('platform_workspace_cards_tenant_sort_idx').on(table.tenantId, table.sortOrder),
    index('platform_workspace_cards_status_idx').on(table.status),
  ],
);

export const platformAppControlCenterModules = appSchema.table(
  'platform_app_control_center_modules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    moduleKey: varchar('module_key', { length: 100 }).notNull(),
    label: varchar('label', { length: 140 }).notNull(),
    description: text('description').notNull(),
    href: text('href').notNull(),
    iconKey: varchar('icon_key', { length: 80 }),
    level: integer('level').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    requiredPermission: varchar('required_permission', { length: 160 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: platformAppExperienceStatusEnum('status').notNull().default('draft'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_app_control_center_modules_key_idx').on(table.moduleKey),
    index('platform_app_control_center_modules_level_sort_idx').on(table.level, table.sortOrder),
    index('platform_app_control_center_modules_status_idx').on(table.status),
  ],
);

export const platformAppExperienceRevisions = appSchema.table(
  'platform_app_experience_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: platformAppExperienceEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    beforeJson: jsonb('before_json').$type<Record<string, unknown> | null>(),
    afterJson: jsonb('after_json').$type<Record<string, unknown> | null>(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('platform_app_experience_revisions_entity_idx').on(table.entityType, table.entityId),
    index('platform_app_experience_revisions_actor_idx').on(table.actorId),
  ],
);

export const platformAppDashboardSettingsRelations = relations(platformAppDashboardSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [platformAppDashboardSettings.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [platformAppDashboardSettings.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformAppDashboardSettings.updatedBy],
    references: [users.id],
  }),
}));

export const platformWorkspaceCardsRelations = relations(platformWorkspaceCards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [platformWorkspaceCards.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [platformWorkspaceCards.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformWorkspaceCards.updatedBy],
    references: [users.id],
  }),
}));

export const platformAppControlCenterModulesRelations = relations(platformAppControlCenterModules, ({ one }) => ({
  creator: one(users, {
    fields: [platformAppControlCenterModules.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [platformAppControlCenterModules.updatedBy],
    references: [users.id],
  }),
}));

export const platformAppExperienceRevisionsRelations = relations(platformAppExperienceRevisions, ({ one }) => ({
  actor: one(users, {
    fields: [platformAppExperienceRevisions.actorId],
    references: [users.id],
  }),
}));

export type PlatformAppDashboardSettings = typeof platformAppDashboardSettings.$inferSelect;
export type NewPlatformAppDashboardSettings = typeof platformAppDashboardSettings.$inferInsert;
export type PlatformWorkspaceCard = typeof platformWorkspaceCards.$inferSelect;
export type NewPlatformWorkspaceCard = typeof platformWorkspaceCards.$inferInsert;
export type PlatformAppControlCenterModule = typeof platformAppControlCenterModules.$inferSelect;
export type NewPlatformAppControlCenterModule = typeof platformAppControlCenterModules.$inferInsert;
export type PlatformAppExperienceRevision = typeof platformAppExperienceRevisions.$inferSelect;
export type NewPlatformAppExperienceRevision = typeof platformAppExperienceRevisions.$inferInsert;
