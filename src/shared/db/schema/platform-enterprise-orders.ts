import { bigint, index, jsonb, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';

export const platformEnterpriseOrders = appSchema.table(
  'platform_enterprise_orders',
  {
    id: text('id').primaryKey(),
    customerName: text('customer_name').notNull(),
    companyName: text('company_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    country: text('country'),
    scopeId: text('scope_id'),
    projectName: text('project_name').notNull(),
    projectDescription: text('project_description'),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    paymentProvider: text('payment_provider').notNull(),
    checkoutStatus: text('checkout_status').notNull().default('created'),
    paymentStatus: text('payment_status').notNull().default('pending'),
    providerCheckoutReference: text('provider_checkout_reference'),
    providerPaymentReference: text('provider_payment_reference'),
    checkoutTokenHash: varchar('checkout_token_hash', { length: 64 }),
    checkoutTokenExpiresAt: timestamp('checkout_token_expires_at', { withTimezone: true }),
    providerPayCurrency: varchar('provider_pay_currency', { length: 24 }),
    idempotencyKey: text('idempotency_key').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('platform_enterprise_orders_idempotency_idx').on(table.idempotencyKey),
    index('platform_enterprise_orders_email_idx').on(table.email),
    index('platform_enterprise_orders_payment_status_idx').on(table.paymentStatus),
    index('platform_enterprise_orders_provider_idx').on(table.paymentProvider),
    index('platform_enterprise_orders_created_idx').on(table.createdAt),
    index('platform_enterprise_orders_checkout_token_hash_idx').on(table.checkoutTokenHash),
  ],
);

export type PlatformEnterpriseOrder = typeof platformEnterpriseOrders.$inferSelect;
export type NewPlatformEnterpriseOrder = typeof platformEnterpriseOrders.$inferInsert;
