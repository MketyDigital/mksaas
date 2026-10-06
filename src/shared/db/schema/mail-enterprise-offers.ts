import { bigint, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import type { MailPlanLimits } from '@/features/mail/commercial/plans';
import { tenants } from './tenants';
import { users } from './auth';
import { appSchema } from './schema';

export const mailEnterpriseOffers = appSchema.table(
  'mail_enterprise_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 180 }).notNull(),
    description: text('description'),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    termDays: integer('term_days'),
    limits: jsonb('limits').$type<MailPlanLimits>().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    orderId: text('order_id'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('mail_enterprise_offers_order_uidx').on(table.orderId),
    index('mail_enterprise_offers_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export type MailEnterpriseOffer = typeof mailEnterpriseOffers.$inferSelect;
export type NewMailEnterpriseOffer = typeof mailEnterpriseOffers.$inferInsert;
