import { index, integer, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';
import { tenants } from './tenants';
import { projects } from './projects';
import { knowledgeDocuments } from './knowledge';

export const knowledgeChunks = appSchema.table(
  'knowledge_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata').$type<Record<string, unknown>>(),
    embedding: vector('embedding', { dimensions: 1536 }),
    embeddingModel: text('embedding_model'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('knowledge_chunks_tenant_idx').on(table.tenantId),
    index('knowledge_chunks_project_idx').on(table.projectId),
    index('knowledge_chunks_document_idx').on(table.documentId),
    index('knowledge_chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
