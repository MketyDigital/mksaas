import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';
import { tenants } from './tenants';

export const customDomainStatusEnum = appSchema.enum('custom_domain_status', ['pending', 'verified', 'disabled']);

/** Custom domains attached to a tenant. Vercel integration is optional for testing. */
export const customDomains = appSchema.table(
  'custom_domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    hostname: varchar('hostname', { length: 255 }).notNull().unique(),
    status: customDomainStatusEnum('status').notNull().default('pending'),
    provider: varchar('provider', { length: 50 }).notNull().default('vercel'),
    providerVerified: text('provider_verified'),
    verification: text('verification'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('custom_domains_tenant_idx').on(table.tenantId)],
);

export type CustomDomain = typeof customDomains.$inferSelect;
export type NewCustomDomain = typeof customDomains.$inferInsert;
