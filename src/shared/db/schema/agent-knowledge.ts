import { index, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { agents } from './agents';
import { knowledgeDocuments } from './knowledge';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const agentKnowledge = appSchema.table(
  'agent_knowledge',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.documentId] }),
    index('agent_knowledge_tenant_idx').on(table.tenantId),
    index('agent_knowledge_project_idx').on(table.projectId),
    index('agent_knowledge_agent_idx').on(table.agentId),
  ],
);

export type AgentKnowledge = typeof agentKnowledge.$inferSelect;
