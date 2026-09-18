import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const tenantEntitlementOverrideEffectEnum = appSchema.enum('tenant_entitlement_override_effect', [
  'grant',
  'deny',
]);

export const tenantEntitlementOverrides = appSchema.table(
  'tenant_entitlement_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    entitlementKey: varchar('entitlement_key', { length: 120 }).notNull(),
    effect: tenantEntitlementOverrideEffectEnum('effect').notNull(),
    reason: text('reason').notNull(),
    source: varchar('source', { length: 80 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tenant_entitlement_overrides_tenant_key_idx').on(table.tenantId, table.entitlementKey),
    index('tenant_entitlement_overrides_expiry_idx').on(table.expiresAt),
  ],
);

export type TenantEntitlementOverride = typeof tenantEntitlementOverrides.$inferSelect;
export type NewTenantEntitlementOverride = typeof tenantEntitlementOverrides.$inferInsert;
