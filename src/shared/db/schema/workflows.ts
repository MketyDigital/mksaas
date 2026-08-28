import { index, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { tenants } from './tenants';
import { appSchema } from './schema';

export const workflows = appSchema.table(
  'workflows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    triggerType: varchar('trigger_type', { length: 40 }).notNull().default('manual'),
    definition: jsonb('definition').$type<WorkflowDefinition>().notNull().default({ nodes: [] }),
    version: varchar('version', { length: 30 }).notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workflows_project_slug_idx').on(table.projectId, table.slug),
    index('workflows_tenant_idx').on(table.tenantId),
    index('workflows_project_idx').on(table.projectId),
    index('workflows_status_idx').on(table.status),
  ],
);

export type WorkflowNode = {
  id: string;
  type: 'trigger' | 'agent' | 'http' | 'transform' | 'condition';
  config: Record<string, unknown>;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
};

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
