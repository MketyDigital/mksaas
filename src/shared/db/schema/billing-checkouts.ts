import { bigint, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPeriods } from './billing-periods';
import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingCheckouts = appSchema.table(
  'billing_checkouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull().references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
    billingPeriodId: uuid('billing_period_id').notNull().references(() => billingPeriods.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 48 }).notNull(),
    providerCheckoutId: text('provider_checkout_id'),
    amountExpectedMinor: bigint('amount_expected_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('created'),
    checkoutUrl: text('checkout_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_checkouts_provider_checkout_idx').on(table.provider, table.providerCheckoutId),
    index('billing_checkouts_tenant_idx').on(table.tenantId),
    index('billing_checkouts_period_idx').on(table.billingPeriodId),
  ],
);

export type BillingCheckout = typeof billingCheckouts.$inferSelect;
export type NewBillingCheckout = typeof billingCheckouts.$inferInsert;
