import { bigint, index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPeriods } from './billing-periods';
import { billingSettlements } from './billing-settlements';
import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingLedgerEntries = appSchema.table(
  'billing_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, { onDelete: 'set null' }),
    billingPeriodId: uuid('billing_period_id').references(() => billingPeriods.id, { onDelete: 'set null' }),
    settlementId: uuid('settlement_id').references(() => billingSettlements.id, { onDelete: 'set null' }),
    entryType: varchar('entry_type', { length: 32 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    reversalOfEntryId: uuid('reversal_of_entry_id'),
    reference: text('reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('billing_ledger_entries_tenant_idx').on(table.tenantId),
    index('billing_ledger_entries_subscription_idx').on(table.subscriptionId),
    index('billing_ledger_entries_period_idx').on(table.billingPeriodId),
    index('billing_ledger_entries_settlement_idx').on(table.settlementId),
  ],
);

export type BillingLedgerEntry = typeof billingLedgerEntries.$inferSelect;
export type NewBillingLedgerEntry = typeof billingLedgerEntries.$inferInsert;
