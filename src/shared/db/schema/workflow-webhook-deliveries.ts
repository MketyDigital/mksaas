import { index, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';
import { workflowRuns } from './workflow-runs';
import { workflowWebhookEndpoints } from './workflow-webhook-endpoints';
import { workflows } from './workflows';

export const workflowWebhookDeliveries = appSchema.table(
  'workflow_webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    webhookEndpointId: uuid('webhook_endpoint_id').notNull().references(() => workflowWebhookEndpoints.id, { onDelete: 'cascade' }),
    eventId: varchar('event_id', { length: 256 }).notNull(),
    eventIdSource: varchar('event_id_source', { length: 20 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('received'),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    errorCode: varchar('error_code', { length: 120 }),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    admittedAt: timestamp('admitted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('workflow_webhook_deliveries_event_identity_idx').on(table.webhookEndpointId, table.eventId),
    index('workflow_webhook_deliveries_tenant_idx').on(table.tenantId),
    index('workflow_webhook_deliveries_project_idx').on(table.projectId),
    index('workflow_webhook_deliveries_workflow_idx').on(table.workflowId),
    index('workflow_webhook_deliveries_endpoint_idx').on(table.webhookEndpointId),
    index('workflow_webhook_deliveries_run_idx').on(table.workflowRunId),
    index('workflow_webhook_deliveries_received_idx').on(table.receivedAt),
  ],
);

export type WorkflowWebhookDelivery = typeof workflowWebhookDeliveries.$inferSelect;
export type NewWorkflowWebhookDelivery = typeof workflowWebhookDeliveries.$inferInsert;
