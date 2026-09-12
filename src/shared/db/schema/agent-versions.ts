import { index, integer, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { agents } from './agents';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const agentVersions = appSchema.table('agent_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  name: varchar('name', { length: 160 }).notNull(),
  instructions: text('instructions'),
  provider: varchar('provider', { length: 40 }).notNull(),
  model: varchar('model', { length: 160 }),
  config: text('config'),
  knowledgeDocumentIds: jsonb('knowledge_document_ids').$type<string[]>().notNull().default([]),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agent_versions_tenant_idx').on(table.tenantId),
  index('agent_versions_project_idx').on(table.projectId),
  index('agent_versions_agent_idx').on(table.agentId),
]);

export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;
