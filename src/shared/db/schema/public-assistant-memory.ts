import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';

export const publicAIVisitors = appSchema.table(
  'public_ai_visitors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [index('public_ai_visitors_last_seen_idx').on(table.lastSeenAt)],
);

export const publicAIConversations = appSchema.table(
  'public_ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => publicAIVisitors.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Mkety AI'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('public_ai_conversations_visitor_idx').on(table.visitorId),
    index('public_ai_conversations_updated_idx').on(table.updatedAt),
  ],
);

export const publicAIMessages = appSchema.table(
  'public_ai_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => publicAIConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('public_ai_messages_conversation_idx').on(table.conversationId),
    index('public_ai_messages_created_idx').on(table.createdAt),
  ],
);

export const publicAIMemoryFacts = appSchema.table(
  'public_ai_memory_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => publicAIVisitors.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('public_ai_memory_facts_visitor_idx').on(table.visitorId),
    index('public_ai_memory_facts_key_idx').on(table.key),
  ],
);

export const publicAIToolRuns = appSchema.table(
  'public_ai_tool_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => publicAIConversations.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    status: text('status').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('public_ai_tool_runs_conversation_idx').on(table.conversationId),
    index('public_ai_tool_runs_tool_idx').on(table.toolName),
  ],
);

export type PublicAIVisitor = typeof publicAIVisitors.$inferSelect;
export type NewPublicAIVisitor = typeof publicAIVisitors.$inferInsert;
export type PublicAIConversation = typeof publicAIConversations.$inferSelect;
export type NewPublicAIConversation = typeof publicAIConversations.$inferInsert;
export type PublicAIMessage = typeof publicAIMessages.$inferSelect;
export type NewPublicAIMessage = typeof publicAIMessages.$inferInsert;
export type PublicAIMemoryFact = typeof publicAIMemoryFacts.$inferSelect;
export type NewPublicAIMemoryFact = typeof publicAIMemoryFacts.$inferInsert;
export type PublicAIToolRun = typeof publicAIToolRuns.$inferSelect;
export type NewPublicAIToolRun = typeof publicAIToolRuns.$inferInsert;
