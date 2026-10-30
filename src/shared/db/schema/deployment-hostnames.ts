import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { deployApplications, deployEnvironments, deployments } from './deployments';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const deploymentHostnames = appSchema.table('deployment_hostnames', {
  id: uuid('id').defaultRandom().primaryKey(),
  hostname: varchar('hostname', { length: 253 }).notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  applicationId: uuid('application_id').notNull().references(() => deployApplications.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').notNull().references(() => deployEnvironments.id, { onDelete: 'cascade' }),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 24 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('deployment_hostnames_hostname_check', sql`${table.hostname} = lower(${table.hostname}) AND ${table.hostname} !~ '\\.$' AND ${table.hostname} ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.mkety\\.app$' AND split_part(${table.hostname}, '.', 1) NOT IN ('www', 'api', 'app', 'admin', 'ops', 'static', 'assets', 'status', 'support', 'docs')`),
  check('deployment_hostnames_kind_check', sql`${table.kind} IN ('preview', 'production')`),
  check('deployment_hostnames_status_check', sql`${table.status} IN ('pending', 'active', 'suspended', 'expired')`),
  uniqueIndex('deployment_hostnames_hostname_uidx').on(table.hostname),
  uniqueIndex('deployment_hostnames_deployment_kind_uidx').on(table.deploymentId, table.kind),
  index('deployment_hostnames_tenant_idx').on(table.tenantId),
  index('deployment_hostnames_project_idx').on(table.projectId),
  index('deployment_hostnames_status_idx').on(table.status),
]);

export type DeploymentHostname = typeof deploymentHostnames.$inferSelect;
export type NewDeploymentHostname = typeof deploymentHostnames.$inferInsert;
