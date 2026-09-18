import { boolean, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPlanVersions } from './billing-plan-versions';
import { appSchema } from './schema';

export const billingPlanVersionEntitlements = appSchema.table(
  'billing_plan_version_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planVersionId: uuid('plan_version_id')
      .notNull()
      .references(() => billingPlanVersions.id, { onDelete: 'cascade' }),
    entitlementKey: varchar('entitlement_key', { length: 120 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_plan_version_entitlements_version_key_idx').on(
      table.planVersionId,
      table.entitlementKey,
    ),
  ],
);

export type BillingPlanVersionEntitlement = typeof billingPlanVersionEntitlements.$inferSelect;
export type NewBillingPlanVersionEntitlement = typeof billingPlanVersionEntitlements.$inferInsert;
