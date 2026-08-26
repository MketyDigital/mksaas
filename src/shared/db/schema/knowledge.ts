import { index, integer, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';
import { tenants } from './tenants';
import { projects } from './projects';

export const knowledgeDocuments = appSchema.table(
  'knowledge_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    sourceType: varchar('source_type', { length: 40 }).notNull().default('text'),
    sourceRef: text('source_ref'),
    status: varchar('status', { length: 30 }).notNull().default('ready'),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('knowledge_documents_tenant_idx').on(table.tenantId),
    index('knowledge_documents_project_idx').on(table.projectId),
  ],
);

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;
