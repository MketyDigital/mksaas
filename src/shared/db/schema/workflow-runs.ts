import { index, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';
import { workflows } from './workflows';

export const workflowRuns = appSchema.table(
  'workflow_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull().default('running'),
    triggerType: varchar('trigger_type', { length: 40 }).notNull().default('manual'),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb('output').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('workflow_runs_tenant_idx').on(table.tenantId),
    index('workflow_runs_project_idx').on(table.projectId),
    index('workflow_runs_workflow_idx').on(table.workflowId),
    index('workflow_runs_status_idx').on(table.status),
    index('workflow_runs_started_idx').on(table.startedAt),
  ],
);

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
