import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';
import { tenants } from './tenants';

export const mailWorkspaces = appSchema.table('mail_workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  planKey: varchar('plan_key', { length: 64 }).notNull().default('starter'),
  onboardingStep: varchar('onboarding_step', { length: 64 }).notNull().default('domain'),
  defaultDomainId: uuid('default_domain_id'),
  storageBytesUsed: bigint('storage_bytes_used', { mode: 'number' }).notNull().default(0),
  monthlySent: integer('monthly_sent').notNull().default(0),
  monthlyCustomerUpdates: integer('monthly_customer_updates').notNull().default(0),
  enabledByUserId: text('enabled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  enabledAt: timestamp('enabled_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_workspaces_tenant_uidx').on(table.tenantId),
  index('mail_workspaces_status_idx').on(table.status),
]);

export const mailDomains = appSchema.table('mail_domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => mailWorkspaces.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  cloudflareZoneId: text('cloudflare_zone_id'),
  sendingEnabled: boolean('sending_enabled').notNull().default(false),
  routingEnabled: boolean('routing_enabled').notNull().default(false),
  spfStatus: varchar('spf_status', { length: 32 }).notNull().default('pending'),
  dkimStatus: varchar('dkim_status', { length: 32 }).notNull().default('pending'),
  dmarcStatus: varchar('dmarc_status', { length: 32 }).notNull().default('pending'),
  mxStatus: varchar('mx_status', { length: 32 }).notNull().default('pending'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_domains_domain_uidx').on(table.domain),
  index('mail_domains_tenant_idx').on(table.tenantId),
  index('mail_domains_workspace_idx').on(table.workspaceId),
]);

export const mailMailboxes = appSchema.table('mail_mailboxes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => mailWorkspaces.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').notNull().references(() => mailDomains.id, { onDelete: 'cascade' }),
  localPart: varchar('local_part', { length: 128 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  type: varchar('type', { length: 32 }).notNull().default('personal'),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  catchAll: boolean('catch_all').notNull().default(false),
  forwardingAddress: varchar('forwarding_address', { length: 320 }),
  signatureHtml: text('signature_html'),
  signatureText: text('signature_text'),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_mailboxes_domain_local_uidx').on(table.domainId, table.localPart),
  index('mail_mailboxes_tenant_idx').on(table.tenantId),
]);

export const mailMailboxMembers = appSchema.table('mail_mailbox_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').notNull().references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_mailbox_members_uidx').on(table.mailboxId, table.userId),
  index('mail_mailbox_members_tenant_idx').on(table.tenantId),
]);

export const mailThreads = appSchema.table('mail_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').notNull().references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  subject: text('subject'),
  status: varchar('status', { length: 32 }).notNull().default('open'),
  priority: varchar('priority', { length: 16 }).notNull().default('normal'),
  assignedUserId: text('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_threads_tenant_mailbox_idx').on(table.tenantId, table.mailboxId),
  index('mail_threads_last_message_idx').on(table.lastMessageAt),
]);

export const mailMessages = appSchema.table('mail_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').notNull().references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').references(() => mailThreads.id, { onDelete: 'set null' }),
  direction: varchar('direction', { length: 16 }).notNull(),
  providerMessageId: text('provider_message_id'),
  internetMessageId: text('internet_message_id'),
  imapUid: bigint('imap_uid', { mode: 'number' }).notNull().default(sql`nextval('saas_template.mail_message_imap_uid_seq')`),
  platformIdempotencyKey: varchar('platform_idempotency_key', { length: 255 }),
  fromAddress: varchar('from_address', { length: 320 }).notNull(),
  toJson: jsonb('to_json').$type<string[]>().notNull().default([]),
  ccJson: jsonb('cc_json').$type<string[]>().notNull().default([]),
  bccJson: jsonb('bcc_json').$type<string[]>().notNull().default([]),
  subject: text('subject'),
  preview: text('preview'),
  rawR2Key: text('raw_r2_key'),
  htmlR2Key: text('html_r2_key'),
  textR2Key: text('text_r2_key'),
  status: varchar('status', { length: 32 }).notNull().default('queued'),
  isRead: boolean('is_read').notNull().default(false),
  isStarred: boolean('is_starred').notNull().default(false),
  folder: varchar('folder', { length: 32 }).notNull().default('inbox'),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_messages_tenant_mailbox_idx').on(table.tenantId, table.mailboxId),
  index('mail_messages_thread_idx').on(table.threadId),
  index('mail_messages_created_idx').on(table.createdAt),
  uniqueIndex('mail_messages_mailbox_imap_uid_uidx').on(table.mailboxId, table.imapUid),
  uniqueIndex('mail_messages_tenant_platform_idempotency_uidx').on(table.tenantId, table.platformIdempotencyKey),
]);


export const mailAttachments = appSchema.table('mail_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => mailMessages.id, { onDelete: 'cascade' }),
  filename: text('filename'),
  contentType: varchar('content_type', { length: 255 }),
  contentId: text('content_id'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  r2Key: text('r2_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_attachments_message_idx').on(table.messageId),
  index('mail_attachments_tenant_idx').on(table.tenantId),
]);

export const mailContacts = appSchema.table('mail_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 255 }),
  company: varchar('company', { length: 255 }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, string>>().notNull().default({}),
  source: varchar('source', { length: 64 }).notNull().default('manual'),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_contacts_tenant_email_uidx').on(table.tenantId, table.email),
  index('mail_contacts_tenant_idx').on(table.tenantId),
]);

export const mailTemplates = appSchema.table('mail_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull().default('transactional'),
  subject: text('subject'),
  html: text('html'),
  text: text('text'),
  variables: jsonb('variables').$type<string[]>().notNull().default([]),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('mail_templates_tenant_idx').on(table.tenantId)]);

export const mailApiKeys = appSchema.table('mail_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_api_keys_hash_uidx').on(table.keyHash),
  index('mail_api_keys_tenant_idx').on(table.tenantId),
]);

export const mailSuppressions = appSchema.table('mail_suppressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  domainId: uuid('domain_id').references(() => mailDomains.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  reason: varchar('reason', { length: 64 }).notNull(),
  source: varchar('source', { length: 64 }).notNull().default('mkety'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_suppressions_tenant_email_uidx').on(table.tenantId, table.email),
  index('mail_suppressions_domain_idx').on(table.domainId),
]);

export const mailCustomerUpdates = appSchema.table('mail_customer_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').notNull().references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  subject: text('subject').notNull(),
  html: text('html'),
  text: text('text'),
  status: varchar('status', { length: 32 }).notNull().default('draft'),
  recipientCount: integer('recipient_count').notNull().default(0),
  queuedCount: integer('queued_count').notNull().default(0),
  deliveredCount: integer('delivered_count').notNull().default(0),
  bouncedCount: integer('bounced_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  complainedCount: integer('complained_count').notNull().default(0),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_customer_updates_tenant_idx').on(table.tenantId),
  index('mail_customer_updates_status_idx').on(table.status),
]);

export const mailCustomerUpdateRecipients = appSchema.table('mail_customer_update_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  updateId: uuid('update_id').notNull().references(() => mailCustomerUpdates.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => mailContacts.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 320 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  providerMessageId: text('provider_message_id'),
  errorCode: varchar('error_code', { length: 64 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_update_recipients_update_email_uidx').on(table.updateId, table.email),
  index('mail_update_recipients_status_idx').on(table.updateId, table.status),
]);

export const mailDeliveryEvents = appSchema.table('mail_delivery_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => mailMessages.id, { onDelete: 'set null' }),
  updateRecipientId: uuid('update_recipient_id').references(() => mailCustomerUpdateRecipients.id, { onDelete: 'set null' }),
  providerEventId: text('provider_event_id'),
  eventType: varchar('event_type', { length: 32 }).notNull(),
  recipient: varchar('recipient', { length: 320 }),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_delivery_events_tenant_idx').on(table.tenantId, table.occurredAt),
  index('mail_delivery_events_message_idx').on(table.messageId),
]);


export const mailThreadNotes = appSchema.table('mail_thread_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => mailThreads.id, { onDelete: 'cascade' }),
  authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_thread_notes_thread_idx').on(table.threadId, table.createdAt),
  index('mail_thread_notes_tenant_idx').on(table.tenantId),
]);

export const mailAutomationRules = appSchema.table('mail_automation_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  triggerType: varchar('trigger_type', { length: 64 }).notNull(),
  triggerValue: text('trigger_value'),
  actionType: varchar('action_type', { length: 64 }).notNull(),
  actionValue: text('action_value'),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mail_automation_rules_tenant_idx').on(table.tenantId),
  index('mail_automation_rules_mailbox_idx').on(table.mailboxId),
]);

export const mailAppPasswords = appSchema.table('mail_app_passwords', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mailboxId: uuid('mailbox_id').notNull().references(() => mailMailboxes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  passwordPrefix: varchar('password_prefix', { length: 32 }).notNull(),
  passwordHash: varchar('password_hash', { length: 128 }).notNull(),
  protocolScope: varchar('protocol_scope', { length: 16 }).$type<'all' | 'smtp'>().notNull().default('all'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('mail_app_passwords_hash_uidx').on(table.passwordHash),
  index('mail_app_passwords_tenant_idx').on(table.tenantId),
  index('mail_app_passwords_mailbox_idx').on(table.mailboxId),
]);
