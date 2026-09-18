import { sql } from 'drizzle-orm';
import { bigint, timestamp, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './schema';
import { tenants } from './tenants';

export const tenantCreditAccounts = appSchema.table('tenant_credit_accounts', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  availableCredits: bigint('available_credits', { mode: 'bigint' }).notNull().default(sql`0`),
  lifetimeGranted: bigint('lifetime_granted', { mode: 'bigint' }).notNull().default(sql`0`),
  lifetimeConsumed: bigint('lifetime_consumed', { mode: 'bigint' }).notNull().default(sql`0`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TenantCreditAccount = typeof tenantCreditAccounts.$inferSelect;
export type NewTenantCreditAccount = typeof tenantCreditAccounts.$inferInsert;
