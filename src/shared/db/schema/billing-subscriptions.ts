import { boolean, index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPlanVersions } from './billing-plan-versions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingSubscriptions = appSchema.table(
  'billing_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    planVersionId: uuid('plan_version_id').notNull().references(() => billingPlanVersions.id),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    renewalMode: varchar('renewal_mode', { length: 32 }).notNull().default('manual'),
    autoRenew: boolean('auto_renew').notNull().default(false),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    gracePeriodEnd: timestamp('grace_period_end', { withTimezone: true }),
    gatewayProvider: varchar('gateway_provider', { length: 48 }),
    providerCustomerRef: text('provider_customer_ref'),
    providerSubscriptionRef: text('provider_subscription_ref'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('billing_subscriptions_tenant_idx').on(table.tenantId),
    index('billing_subscriptions_plan_version_idx').on(table.planVersionId),
  ],
);

export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type NewBillingSubscription = typeof billingSubscriptions.$inferInsert;
