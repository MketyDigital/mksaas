import { boolean, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const deployApplications = appSchema.table(
  'deploy_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('web'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('deploy_applications_project_slug_idx').on(table.projectId, table.slug),
    index('deploy_applications_tenant_idx').on(table.tenantId),
    index('deploy_applications_project_idx').on(table.projectId),
  ],
);

export const deployEnvironments = appSchema.table(
  'deploy_environments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull().references(() => deployApplications.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull().default('development'),
    protected: boolean('protected').notNull().default(false),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('deploy_environments_application_slug_idx').on(table.applicationId, table.slug),
    index('deploy_environments_tenant_idx').on(table.tenantId),
    index('deploy_environments_project_idx').on(table.projectId),
    index('deploy_environments_application_idx').on(table.applicationId),
  ],
);

export const deployments = appSchema.table(
  'deployments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull().references(() => deployApplications.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').notNull().references(() => deployEnvironments.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull().default('queued'),
    releaseRef: text('release_ref'),
    sourceRef: text('source_ref'),
    provider: varchar('provider', { length: 48 }),
    providerDeploymentRef: text('provider_deployment_ref'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('deployments_tenant_idx').on(table.tenantId),
    index('deployments_project_idx').on(table.projectId),
    index('deployments_application_idx').on(table.applicationId),
    index('deployments_environment_idx').on(table.environmentId),
    index('deployments_status_idx').on(table.status),
    index('deployments_created_idx').on(table.createdAt),
  ],
);

export type DeployApplication = typeof deployApplications.$inferSelect;
export type NewDeployApplication = typeof deployApplications.$inferInsert;
export type DeployEnvironment = typeof deployEnvironments.$inferSelect;
export type NewDeployEnvironment = typeof deployEnvironments.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
