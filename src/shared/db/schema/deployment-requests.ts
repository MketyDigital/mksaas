import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { deployApplications, deployEnvironments, deployments } from './deployments';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const deploymentRequests = appSchema.table(
  'deployment_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull().references(() => deployApplications.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').notNull().references(() => deployEnvironments.id, { onDelete: 'cascade' }),
    requestedByUserId: text('requested_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    executionDeploymentId: uuid('execution_deployment_id').references(() => deployments.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    releaseRef: text('release_ref').notNull(),
    sourceRef: text('source_ref'),
    reviewNote: text('review_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('deployment_requests_tenant_idx').on(table.tenantId),
    index('deployment_requests_project_idx').on(table.projectId),
    index('deployment_requests_environment_idx').on(table.environmentId),
    index('deployment_requests_status_idx').on(table.status),
    index('deployment_requests_requested_idx').on(table.requestedAt),
  ],
);

export type DeploymentRequest = typeof deploymentRequests.$inferSelect;
export type NewDeploymentRequest = typeof deploymentRequests.$inferInsert;
