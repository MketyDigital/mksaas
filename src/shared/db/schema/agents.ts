import { index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { tenants } from './tenants';
import { appSchema } from './schema';

export const agents = appSchema.table(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    instructions: text('instructions'),
    provider: varchar('provider', { length: 40 }).notNull().default('platform'),
    model: varchar('model', { length: 160 }),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    config: text('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('agents_project_slug_idx').on(table.projectId, table.slug),
    index('agents_tenant_idx').on(table.tenantId),
    index('agents_project_idx').on(table.projectId),
  ],
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
