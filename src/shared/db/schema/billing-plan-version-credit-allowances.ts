import { bigint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPlanVersions } from './billing-plan-versions';
import { appSchema } from './schema';

export const billingPlanVersionCreditAllowances = appSchema.table(
  'billing_plan_version_credit_allowances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planVersionId: uuid('plan_version_id')
      .notNull()
      .references(() => billingPlanVersions.id, { onDelete: 'cascade' }),
    creditAmount: bigint('credit_amount', { mode: 'bigint' }).notNull(),
    grantInterval: varchar('grant_interval', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_plan_version_credit_allowances_plan_version_interval_idx').on(
      table.planVersionId,
      table.grantInterval,
    ),
  ],
);

export type BillingPlanVersionCreditAllowance = typeof billingPlanVersionCreditAllowances.$inferSelect;
export type NewBillingPlanVersionCreditAllowance = typeof billingPlanVersionCreditAllowances.$inferInsert;
