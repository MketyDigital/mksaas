import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPeriods } from './billing-periods';
import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingRenewalAttempts = appSchema.table(
  'billing_renewal_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').notNull().references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
    billingPeriodId: uuid('billing_period_id').references(() => billingPeriods.id, { onDelete: 'set null' }),
    mode: varchar('mode', { length: 32 }).notNull(),
    provider: varchar('provider', { length: 48 }),
    status: varchar('status', { length: 24 }).notNull().default('prepared'),
    outcomeReference: text('outcome_reference'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('billing_renewal_attempts_tenant_idx').on(table.tenantId),
    index('billing_renewal_attempts_subscription_idx').on(table.subscriptionId),
  ],
);

export type BillingRenewalAttempt = typeof billingRenewalAttempts.$inferSelect;
export type NewBillingRenewalAttempt = typeof billingRenewalAttempts.$inferInsert;
