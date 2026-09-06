import { index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';
import { workflows } from './workflows';

export const workflowWebhookEndpoints = appSchema.table(
  'workflow_webhook_endpoints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    endpointId: varchar('endpoint_id', { length: 96 }).notNull(),
    secretCiphertext: text('secret_ciphertext').notNull(),
    secretFingerprint: varchar('secret_fingerprint', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('workflow_webhook_endpoints_endpoint_id_idx').on(table.endpointId),
    index('workflow_webhook_endpoints_tenant_idx').on(table.tenantId),
    index('workflow_webhook_endpoints_project_idx').on(table.projectId),
    index('workflow_webhook_endpoints_workflow_idx').on(table.workflowId),
  ],
);

export type WorkflowWebhookEndpoint = typeof workflowWebhookEndpoints.$inferSelect;
export type NewWorkflowWebhookEndpoint = typeof workflowWebhookEndpoints.$inferInsert;
