import { bigint, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { billingPeriods } from './billing-periods';
import { billingSubscriptions } from './billing-subscriptions';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const billingManualAdjustments = appSchema.table(
  'billing_manual_adjustments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, { onDelete: 'set null' }),
    billingPeriodId: uuid('billing_period_id').references(() => billingPeriods.id, { onDelete: 'set null' }),
    actorUserId: text('actor_user_id').notNull().references(() => users.id),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    adjustmentType: varchar('adjustment_type', { length: 32 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    reason: text('reason').notNull(),
    reference: text('reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_manual_adjustments_idempotency_idx').on(table.tenantId, table.idempotencyKey),
  ],
);

export type BillingManualAdjustment = typeof billingManualAdjustments.$inferSelect;
export type NewBillingManualAdjustment = typeof billingManualAdjustments.$inferInsert;
