import { index, integer, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { agents } from './agents';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const agentRuns = appSchema.table(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull().default('running'),
    messages: jsonb('messages').$type<unknown[]>().notNull().default([]),
    output: text('output'),
    error: text('error'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('agent_runs_tenant_idx').on(table.tenantId),
    index('agent_runs_project_idx').on(table.projectId),
    index('agent_runs_agent_idx').on(table.agentId),
    index('agent_runs_started_idx').on(table.startedAt),
  ],
);

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
