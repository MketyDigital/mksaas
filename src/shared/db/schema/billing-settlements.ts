import { bigint, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPeriods } from './billing-periods';
import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingSettlements = appSchema.table(
  'billing_settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull().references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
    billingPeriodId: uuid('billing_period_id').notNull().references(() => billingPeriods.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 48 }).notNull(),
    providerPaymentId: text('provider_payment_id'),
    providerEventId: text('provider_event_id'),
    settlementType: varchar('settlement_type', { length: 32 }).notNull().default('payment'),
    amountExpectedMinor: bigint('amount_expected_minor', { mode: 'number' }).notNull(),
    currencyExpected: varchar('currency_expected', { length: 3 }).notNull(),
    amountPaidMinor: bigint('amount_paid_minor', { mode: 'number' }).notNull(),
    currencyPaid: varchar('currency_paid', { length: 3 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('received'),
    rawReference: text('raw_reference'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_settlements_provider_event_idx').on(table.provider, table.providerEventId),
    uniqueIndex('billing_settlements_provider_payment_type_idx').on(
      table.provider,
      table.providerPaymentId,
      table.settlementType,
    ),
    index('billing_settlements_tenant_idx').on(table.tenantId),
    index('billing_settlements_period_idx').on(table.billingPeriodId),
  ],
);

export type BillingSettlement = typeof billingSettlements.$inferSelect;
export type NewBillingSettlement = typeof billingSettlements.$inferInsert;
