import { index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';

export const DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES = [
  'USD',
  'NGN',
  'GHS',
  'KES',
  'GBP',
  'EUR',
  'ZAR',
  'XAF',
  'XOF',
  'UGX',
  'RWF',
  'TZS',
  'EGP',
  'MWK',
] as const;

export const platformPaymentSettings = appSchema.table(
  'platform_payment_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    environment: varchar('environment', { length: 40 }).notNull().default('production'),
    baseCurrency: varchar('base_currency', { length: 3 }).notNull().default('USD'),
    flutterwaveEnabledCurrenciesJson: jsonb('flutterwave_enabled_currencies_json')
      .$type<string[]>()
      .notNull()
      .default([...DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES]),
    flutterwaveFxRatesJson: jsonb('flutterwave_fx_rates_json')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    flutterwaveFxMarkupBps: integer('flutterwave_fx_markup_bps').notNull().default(0),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('platform_payment_settings_environment_idx').on(table.environment)],
);

export const paymentCheckoutSessions = appSchema.table(
  'payment_checkout_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 40 }).notNull(),
    source: varchar('source', { length: 40 }).notNull(),
    reference: varchar('reference', { length: 80 }).notNull(),
    canonicalAmountMinor: text('canonical_amount_minor').notNull(),
    canonicalCurrency: varchar('canonical_currency', { length: 3 }).notNull(),
    collectionAmountMinor: text('collection_amount_minor').notNull(),
    collectionCurrency: varchar('collection_currency', { length: 3 }).notNull(),
    customerEmail: varchar('customer_email', { length: 254 }).notNull(),
    customerName: varchar('customer_name', { length: 180 }),
    redirectUrl: text('redirect_url').notNull(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('created'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_checkout_sessions_provider_reference_idx').on(table.provider, table.reference),
    index('payment_checkout_sessions_expires_idx').on(table.expiresAt),
  ],
);

export type PlatformPaymentSettings = typeof platformPaymentSettings.$inferSelect;
export type PaymentCheckoutSession = typeof paymentCheckoutSessions.$inferSelect;
