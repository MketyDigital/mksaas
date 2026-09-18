import { bigint, index, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const usageEvents = appSchema.table(
  'usage_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meterKey: varchar('meter_key', { length: 120 }).notNull(),
    quantity: bigint('quantity', { mode: 'bigint' }).notNull(),
    creditsCharged: bigint('credits_charged', { mode: 'bigint' }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    workspaceKey: varchar('workspace_key', { length: 120 }),
    source: varchar('source', { length: 80 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('usage_events_tenant_idempotency_idx').on(table.tenantId, table.idempotencyKey),
    index('usage_events_tenant_meter_occurred_idx').on(table.tenantId, table.meterKey, table.occurredAt),
  ],
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
