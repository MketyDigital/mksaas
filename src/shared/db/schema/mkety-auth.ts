import { index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';

export const externalIdentities = appSchema.table(
  'external_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    name: text('name'),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('external_identities_provider_subject_idx').on(table.provider, table.subject),
    index('external_identities_user_idx').on(table.userId),
  ],
);

export const authLoginTransactions = appSchema.table(
  'auth_login_transactions',
  {
    state: text('state').primaryKey(),
    provider: text('provider').notNull(),
    verifier: text('verifier').notNull(),
    nonce: text('nonce').notNull(),
    returnTo: text('return_to').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('auth_login_transactions_expires_idx').on(table.expiresAt)],
);

export const authSessions = appSchema.table(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('auth_sessions_token_hash_idx').on(table.tokenHash),
    index('auth_sessions_user_idx').on(table.userId),
    index('auth_sessions_expires_idx').on(table.expiresAt),
  ],
);

export type ExternalIdentityRecord = typeof externalIdentities.$inferSelect;
export type NewExternalIdentityRecord = typeof externalIdentities.$inferInsert;
export type AuthLoginTransaction = typeof authLoginTransactions.$inferSelect;
export type NewAuthLoginTransaction = typeof authLoginTransactions.$inferInsert;
export type AuthSessionRecord = typeof authSessions.$inferSelect;
export type NewAuthSessionRecord = typeof authSessions.$inferInsert;
