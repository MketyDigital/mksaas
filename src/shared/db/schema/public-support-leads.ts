import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { publicAIConversations } from './public-assistant-memory';
import { appSchema } from './schema';

export const publicSupportLeads = appSchema.table(
  'public_support_leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').references(() => publicAIConversations.id, { onDelete: 'set null' }),
    intent: varchar('intent', { length: 32 }).notNull().default('general'),
    name: varchar('name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 80 }),
    message: text('message').notNull(),
    sourcePath: text('source_path'),
    status: varchar('status', { length: 32 }).notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('public_support_leads_status_idx').on(table.status),
    index('public_support_leads_created_idx').on(table.createdAt),
    index('public_support_leads_email_idx').on(table.email),
  ],
);

export type PublicSupportLead = typeof publicSupportLeads.$inferSelect;
export type NewPublicSupportLead = typeof publicSupportLeads.$inferInsert;
