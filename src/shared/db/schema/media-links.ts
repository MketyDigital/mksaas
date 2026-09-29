import { index, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const mediaTenantLinks = appSchema.table('media_tenant_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  externalWorkspaceRef: varchar('external_workspace_ref', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('linked'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('media_tenant_links_tenant_uidx').on(table.tenantId),
  index('media_tenant_links_status_idx').on(table.status),
  index('media_tenant_links_external_ref_idx').on(table.externalWorkspaceRef),
]);
