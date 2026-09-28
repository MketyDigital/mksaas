import { bigint, boolean, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { creditLedgerEntries } from './credit-ledger-entries';
import { projects } from './projects';
import { appSchema } from './schema';
import { tenants } from './tenants';
import { usageEvents } from './usage-events';

export type AiModelCapabilities = {
  text: boolean;
  vision: boolean;
  embeddings: boolean;
  tools: boolean;
  reasoning: boolean;
  structuredOutput: boolean;
};

export type AiModelLimits = {
  contextTokens: number;
  maxOutputTokens?: number;
};

export const aiApiKeys = appSchema.table('ai_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  environment: varchar('environment', { length: 16 }).notNull().default('live'),
  name: varchar('name', { length: 128 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 40 }).notNull(),
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_api_keys_hash_uidx').on(table.keyHash),
  index('ai_api_keys_tenant_idx').on(table.tenantId),
  index('ai_api_keys_project_idx').on(table.projectId),
]);

export const aiModels = appSchema.table('ai_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerKey: varchar('provider_key', { length: 64 }).notNull(),
  nativeModel: varchar('native_model', { length: 200 }).notNull(),
  displayName: varchar('display_name', { length: 160 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('candidate'),
  managed: boolean('managed').notNull().default(true),
  enabled: boolean('enabled').notNull().default(false),
  capabilities: jsonb('capabilities').$type<AiModelCapabilities>().notNull(),
  limits: jsonb('limits').$type<AiModelLimits>().notNull(),
  providerCostMetadata: jsonb('provider_cost_metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_models_provider_native_uidx').on(table.providerKey, table.nativeModel),
  index('ai_models_enabled_idx').on(table.enabled, table.status),
]);

export const aiModelAliases = appSchema.table('ai_model_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  alias: varchar('alias', { length: 128 }).notNull(),
  modelId: uuid('model_id').notNull().references(() => aiModels.id, { onDelete: 'cascade' }),
  stable: boolean('stable').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_model_aliases_alias_uidx').on(table.alias),
  index('ai_model_aliases_model_idx').on(table.modelId),
]);

export const aiProviderConnections = appSchema.table('ai_provider_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  providerKey: varchar('provider_key', { length: 64 }).notNull(),
  mode: varchar('mode', { length: 24 }).notNull(),
  secretRef: text('secret_ref'),
  endpointUrl: text('endpoint_url'),
  status: varchar('status', { length: 32 }).notNull().default('disabled'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_provider_connections_tenant_idx').on(table.tenantId),
  index('ai_provider_connections_project_idx').on(table.projectId),
]);

export const aiRoutes = appSchema.table('ai_routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  modelAlias: varchar('model_alias', { length: 128 }).notNull(),
  providerConnectionId: uuid('provider_connection_id').references(() => aiProviderConnections.id, { onDelete: 'set null' }),
  priority: integer('priority').notNull().default(100),
  enabled: boolean('enabled').notNull().default(false),
  policy: jsonb('policy').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_routes_scope_alias_idx').on(table.tenantId, table.projectId, table.modelAlias, table.priority),
]);

export const aiBudgets = appSchema.table('ai_budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id').references(() => aiApiKeys.id, { onDelete: 'cascade' }),
  period: varchar('period', { length: 24 }).notNull().default('monthly'),
  maxCredits: bigint('max_credits', { mode: 'bigint' }),
  maxRequests: bigint('max_requests', { mode: 'bigint' }),
  usedCredits: bigint('used_credits', { mode: 'bigint' }).notNull().default(0n),
  usedRequests: bigint('used_requests', { mode: 'bigint' }).notNull().default(0n),
  hardStop: boolean('hard_stop').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_budgets_scope_period_idx').on(table.tenantId, table.projectId, table.startsAt, table.endsAt),
  index('ai_budgets_api_key_idx').on(table.apiKeyId),
]);

export const aiRequests = appSchema.table('ai_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  apiKeyId: uuid('api_key_id').references(() => aiApiKeys.id, { onDelete: 'set null' }),
  idempotencyKey: varchar('idempotency_key', { length: 180 }).notNull(),
  modelAlias: varchar('model_alias', { length: 128 }).notNull(),
  providerKey: varchar('provider_key', { length: 64 }),
  nativeModel: varchar('native_model', { length: 200 }),
  status: varchar('status', { length: 32 }).notNull().default('authorized'),
  inputTokens: bigint('input_tokens', { mode: 'bigint' }).notNull().default(0n),
  cachedInputTokens: bigint('cached_input_tokens', { mode: 'bigint' }).notNull().default(0n),
  outputTokens: bigint('output_tokens', { mode: 'bigint' }).notNull().default(0n),
  providerCostMetadata: jsonb('provider_cost_metadata').$type<Record<string, unknown>>().notNull().default({}),
  errorCode: varchar('error_code', { length: 80 }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ai_requests_tenant_idempotency_uidx').on(table.tenantId, table.idempotencyKey),
  index('ai_requests_tenant_started_idx').on(table.tenantId, table.startedAt),
  index('ai_requests_project_started_idx').on(table.projectId, table.startedAt),
]);

export const aiCreditReservations = appSchema.table('ai_credit_reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  apiKeyId: uuid('api_key_id').references(() => aiApiKeys.id, { onDelete: 'set null' }),
  requestId: uuid('request_id').references(() => aiRequests.id, { onDelete: 'set null' }),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('held'),
  reservedCredits: bigint('reserved_credits', { mode: 'bigint' }).notNull(),
  settledCredits: bigint('settled_credits', { mode: 'bigint' }),
  holdLedgerEntryId: uuid('hold_ledger_entry_id').references(() => creditLedgerEntries.id, { onDelete: 'set null' }),
  releaseLedgerEntryId: uuid('release_ledger_entry_id').references(() => creditLedgerEntries.id, { onDelete: 'set null' }),
  usageEventId: uuid('usage_event_id').references(() => usageEvents.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: varchar('release_reason', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_credit_reservations_tenant_idempotency_uidx').on(table.tenantId, table.idempotencyKey),
  index('ai_credit_reservations_tenant_status_expiry_idx').on(table.tenantId, table.status, table.expiresAt),
  index('ai_credit_reservations_request_idx').on(table.requestId),
]);

export type AiApiKey = typeof aiApiKeys.$inferSelect;
export type AiModel = typeof aiModels.$inferSelect;
export type AiBudget = typeof aiBudgets.$inferSelect;
export type AiCreditReservation = typeof aiCreditReservations.$inferSelect;
