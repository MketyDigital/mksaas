import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { mailDomains, mailMailboxes, mailMessages, mailWorkspaces } from './mail';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const mailMigrationRuns = appSchema.table(
  'mail_migration_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => mailWorkspaces.id, { onDelete: 'cascade' }),
    sourceMailboxAddress: varchar('source_mailbox_address', { length: 320 }).notNull(),
    destinationMailboxId: uuid('destination_mailbox_id')
      .notNull()
      .references(() => mailMailboxes.id, { onDelete: 'cascade' }),
    sourceType: varchar('source_type', { length: 32 }).notNull(),
    sourceHost: varchar('source_host', { length: 253 }),
    sourcePort: integer('source_port'),
    encryptedCredential: text('encrypted_credential'),
    mode: varchar('mode', { length: 16 }).notNull().default('initial'),
    status: varchar('status', { length: 24 }).notNull().default('queued'),
    sourceCursor: jsonb('source_cursor').$type<Record<string, unknown>>().notNull().default({}),
    totalMessages: integer('total_messages').notNull().default(0),
    importedMessages: integer('imported_messages').notNull().default(0),
    skippedMessages: integer('skipped_messages').notNull().default(0),
    failedMessages: integer('failed_messages').notNull().default(0),
    safeErrorCode: varchar('safe_error_code', { length: 64 }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('mail_migration_runs_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('mail_migration_runs_status_idx').on(table.status, table.updatedAt),
  ],
);

export const mailMigrationMessages = appSchema.table(
  'mail_migration_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    migrationRunId: uuid('migration_run_id')
      .notNull()
      .references(() => mailMigrationRuns.id, { onDelete: 'cascade' }),
    sourceKey: varchar('source_key', { length: 512 }).notNull(),
    folderPath: text('folder_path').notNull(),
    sourceUidValidity: varchar('source_uid_validity', { length: 128 }),
    sourceUid: varchar('source_uid', { length: 128 }),
    internetMessageId: text('internet_message_id'),
    contentFingerprint: varchar('content_fingerprint', { length: 128 }).notNull(),
    targetMessageId: uuid('target_message_id')
      .notNull()
      .references(() => mailMessages.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('mail_migration_messages_source_uid_uidx').on(
      table.tenantId,
      table.sourceKey,
      table.folderPath,
      table.sourceUidValidity,
      table.sourceUid,
    ),
    uniqueIndex('mail_migration_messages_source_fingerprint_uidx').on(
      table.tenantId,
      table.sourceKey,
      table.folderPath,
      table.contentFingerprint,
    ),
    index('mail_migration_messages_tenant_idx').on(table.tenantId, table.createdAt),
  ],
);

export const mailDomainCutovers = appSchema.table(
  'mail_domain_cutovers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => mailDomains.id, { onDelete: 'cascade' }),
    state: varchar('state', { length: 32 }).notNull().default('inventory'),
    previousDnsRecords: jsonb('previous_dns_records').$type<Array<Record<string, unknown>>>().notNull().default([]),
    authorizedByUserId: text('authorized_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('mail_domain_cutovers_tenant_domain_uidx').on(table.tenantId, table.domainId)],
);

export const mailDomainCutoverChecks = appSchema.table(
  'mail_domain_cutover_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    cutoverId: uuid('cutover_id')
      .notNull()
      .references(() => mailDomainCutovers.id, { onDelete: 'cascade' }),
    checkName: varchar('check_name', { length: 64 }).notNull(),
    passed: boolean('passed').notNull(),
    evidenceRef: text('evidence_ref'),
    safeDetails: jsonb('safe_details').$type<Record<string, unknown>>().notNull().default({}),
    checkedByUserId: text('checked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('mail_domain_cutover_checks_name_uidx').on(table.cutoverId, table.checkName),
    index('mail_domain_cutover_checks_tenant_idx').on(table.tenantId, table.checkedAt),
  ],
);
