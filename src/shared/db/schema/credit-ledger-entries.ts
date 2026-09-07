import { bigint, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { billingPeriods } from './billing-periods';
import { appSchema } from './schema';
import { tenants } from './tenants';
import { usageEvents } from './usage-events';

export const creditLedgerEntryTypeEnum = appSchema.enum('credit_ledger_entry_type', [
  'period_grant',
  'usage',
  'manual_grant',
  'manual_debit',
  'adjustment',
]);

export const creditLedgerEntries = appSchema.table(
  'credit_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    delta: bigint('delta', { mode: 'bigint' }).notNull(),
    entryType: creditLedgerEntryTypeEnum('entry_type').notNull(),
    source: varchar('source', { length: 80 }).notNull(),
    billingPeriodId: uuid('billing_period_id').references(() => billingPeriods.id, { onDelete: 'set null' }),
    usageEventId: uuid('usage_event_id').references(() => usageEvents.id, { onDelete: 'set null' }),
    idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
    reason: text('reason'),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('credit_ledger_entries_tenant_idempotency_idx').on(table.tenantId, table.idempotencyKey),
    index('credit_ledger_entries_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('credit_ledger_entries_billing_period_idx').on(table.billingPeriodId),
    index('credit_ledger_entries_usage_event_idx').on(table.usageEventId),
  ],
);

export type CreditLedgerEntry = typeof creditLedgerEntries.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedgerEntries.$inferInsert;
