import { bigint, index, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingPeriods = appSchema.table(
  'billing_periods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull().references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    amountDueMinor: bigint('amount_due_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    collectionStatus: varchar('collection_status', { length: 24 }).notNull().default('open'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_periods_subscription_period_idx').on(
      table.subscriptionId,
      table.periodStart,
      table.periodEnd,
    ),
    index('billing_periods_tenant_idx').on(table.tenantId),
  ],
);

export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type NewBillingPeriod = typeof billingPeriods.$inferInsert;
