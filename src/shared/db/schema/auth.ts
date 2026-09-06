/**
 * Identity compatibility and tenant authorization schema.
 *
 * The legacy template created provider/session tables for Auth.js. Mkety no
 * longer uses Auth.js as its identity architecture, but the tables remain in
 * the schema for migration compatibility until a dedicated identity migration
 * safely retires or repurposes them. Tenant memberships and RBAC remain active
 * Mkety-owned authorization data.
 */

import { relations } from 'drizzle-orm';
import { boolean, index, integer, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { persons } from './persons';
import { roles } from './roles';
import { appSchema } from './schema';
import { tenants } from './tenants';

export type IdentityAccountType = 'oauth' | 'oidc' | 'email' | 'credentials' | 'webauthn' | string;

export const tenantRoleEnum = appSchema.enum('tenant_role', ['member', 'manager', 'admin']);

export const users = appSchema.table('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = appSchema.table(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<IdentityAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = appSchema.table('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = appSchema.table(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

export const authenticators = appSchema.table(
  'authenticators',
  {
    credentialID: text('credential_id').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerAccountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: boolean('credential_backed_up').notNull(),
    transports: text('transports'),
  },
  (authenticator) => [
    primaryKey({ columns: [authenticator.userId, authenticator.credentialID] }),
  ],
);

export const tenantMemberships = appSchema.table(
  'tenant_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    role: tenantRoleEnum('role').notNull().default('member'),
    primaryRoleId: uuid('primary_role_id').references(() => roles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_memberships_user_tenant_idx').on(table.userId, table.tenantId),
    index('tenant_memberships_tenant_idx').on(table.tenantId),
    index('tenant_memberships_user_idx').on(table.userId),
  ],
);

export const tenantMembershipRoles = appSchema.table(
  'tenant_membership_roles',
  {
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.roleId] }),
    index('tenant_membership_roles_membership_idx').on(table.membershipId),
    index('tenant_membership_roles_role_idx').on(table.roleId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  memberships: many(tenantMemberships),
}));

export const tenantMembershipsRelations = relations(tenantMemberships, ({ one, many }) => ({
  user: one(users, {
    fields: [tenantMemberships.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [tenantMemberships.tenantId],
    references: [tenants.id],
  }),
  person: one(persons, {
    fields: [tenantMemberships.personId],
    references: [persons.id],
  }),
  primaryRole: one(roles, {
    fields: [tenantMemberships.primaryRoleId],
    references: [roles.id],
  }),
  membershipRoles: many(tenantMembershipRoles),
}));

export const tenantMembershipRolesRelations = relations(tenantMembershipRoles, ({ one }) => ({
  membership: one(tenantMemberships, {
    fields: [tenantMembershipRoles.membershipId],
    references: [tenantMemberships.id],
  }),
  role: one(roles, {
    fields: [tenantMembershipRoles.roleId],
    references: [roles.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
export type TenantMembershipRole = typeof tenantMembershipRoles.$inferSelect;
export type TenantRole = (typeof tenantRoleEnum.enumValues)[number];
