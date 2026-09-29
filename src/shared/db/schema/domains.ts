import { boolean, index, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';
import { tenants } from './tenants';

export const customDomainStatusEnum = appSchema.enum('custom_domain_status', ['pending', 'verified', 'disabled']);
export const managedDomainStatusEnum = appSchema.enum('managed_domain_status', [
  'pending',
  'active',
  'expired',
  'suspended',
]);

/** Customer-owned custom hostnames attached to a tenant through Mkety-managed routing. */
export const customDomains = appSchema.table(
  'custom_domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    hostname: varchar('hostname', { length: 255 }).notNull().unique(),
    status: customDomainStatusEnum('status').notNull().default('pending'),
    provider: varchar('provider', { length: 50 }).notNull().default('mkety'),
    providerVerified: text('provider_verified'),
    verification: text('verification'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('custom_domains_tenant_idx').on(table.tenantId)],
);

export type CustomDomain = typeof customDomains.$inferSelect;
export type NewCustomDomain = typeof customDomains.$inferInsert;


export const managedDomains = appSchema.table(
  'managed_domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 255 }).notNull(),
    status: managedDomainStatusEnum('status').notNull().default('pending'),
    providerDomainRef: text('provider_domain_ref'),
    registrationOrderId: varchar('registration_order_id', { length: 160 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    autoRenew: boolean('auto_renew').notNull().default(false),
    dnsZoneId: text('dns_zone_id'),
    dnsStatus: varchar('dns_status', { length: 40 }).notNull().default('pending'),
    nameServers: jsonb('name_servers').$type<string[]>().notNull().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('managed_domains_domain_uidx').on(table.domain),
    uniqueIndex('managed_domains_tenant_order_uidx').on(table.tenantId, table.registrationOrderId),
    index('managed_domains_tenant_status_idx').on(table.tenantId, table.status),
    index('managed_domains_expiry_idx').on(table.expiresAt),
  ],
);

export type ManagedDomain = typeof managedDomains.$inferSelect;
export type NewManagedDomain = typeof managedDomains.$inferInsert;
