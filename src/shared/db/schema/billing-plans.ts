import { text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';

export const billingPlans = appSchema.table(
  'billing_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 96 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('billing_plans_key_idx').on(table.key)],
);

export type BillingPlan = typeof billingPlans.$inferSelect;
export type NewBillingPlan = typeof billingPlans.$inferInsert;
