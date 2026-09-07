import { bigint, boolean, integer, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { billingPlans } from './billing-plans';
import { appSchema } from './schema';

export const billingPlanVersions = appSchema.table(
  'billing_plan_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id').notNull().references(() => billingPlans.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    billingInterval: varchar('billing_interval', { length: 24 }).notNull(),
    isPublic: boolean('is_public').notNull().default(true),
    metadataReference: text('metadata_reference'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('billing_plan_versions_plan_version_idx').on(table.planId, table.version)],
);

export type BillingPlanVersion = typeof billingPlanVersions.$inferSelect;
export type NewBillingPlanVersion = typeof billingPlanVersions.$inferInsert;
