import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, integer, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { billingPlanVersions } from './billing-plan-versions';
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
  reservedCredits: bigint('reserved_credits', { mode: 'bigint' }).notNull().default(0n),
  reservedRequests: bigint('reserved_requests', { mode: 'bigint' }).notNull().default(0n),
  hardStop: boolean('hard_stop').notNull().default(true),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_budgets_scope_period_idx').on(table.tenantId, table.projectId, table.startsAt, table.endsAt),
  index('ai_budgets_api_key_idx').on(table.apiKeyId),
]);

export const aiRateCards = appSchema.table('ai_rate_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  modelId: uuid('model_id').notNull().references(() => aiModels.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  status: varchar('status', { length: 24 }).notNull().default('draft'),
  inputCreditsPerMillion: bigint('input_credits_per_million', { mode: 'bigint' }).notNull(),
  cachedInputCreditsPerMillion: bigint('cached_input_credits_per_million', { mode: 'bigint' }),
  outputCreditsPerMillion: bigint('output_credits_per_million', { mode: 'bigint' }).notNull(),
  minimumCreditsPerRequest: bigint('minimum_credits_per_request', { mode: 'bigint' }).notNull().default(1n),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_rate_cards_model_version_uidx').on(table.modelId, table.version),
  index('ai_rate_cards_model_status_effective_idx').on(table.modelId, table.status, table.effectiveFrom),
  check(
    'ai_rate_cards_positive_rates_check',
    sql`${table.inputCreditsPerMillion} > 0 AND ${table.outputCreditsPerMillion} > 0 AND ${table.minimumCreditsPerRequest} > 0`,
  ),
  check(
    'ai_rate_cards_cached_rate_check',
    sql`${table.cachedInputCreditsPerMillion} IS NULL OR ${table.cachedInputCreditsPerMillion} > 0`,
  ),
]);

export const aiEnterpriseCommercialPolicies = appSchema.table('ai_enterprise_commercial_policies', {
  planVersionId: uuid('plan_version_id').primaryKey().references(() => billingPlanVersions.id, { onDelete: 'cascade' }),
  minimumFundingMinor: bigint('minimum_funding_minor', { mode: 'bigint' }).notNull(),
  managedCostShareBps: integer('managed_cost_share_bps').notNull().default(1500),
  setupFeeMinor: bigint('setup_fee_minor', { mode: 'bigint' }).notNull().default(0n),
  fundingMode: varchar('funding_mode', { length: 32 }).notNull().default('full_period'),
  creditRollover: boolean('credit_rollover').notNull().default(true),
  hardStop: boolean('hard_stop').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('ai_enterprise_commercial_policy_funding_check', sql`${table.minimumFundingMinor} > 0 AND ${table.setupFeeMinor} >= 0`),
  check('ai_enterprise_commercial_policy_share_check', sql`${table.managedCostShareBps} BETWEEN 1 AND 10000`),
  check('ai_enterprise_commercial_policy_mode_check', sql`${table.fundingMode} IN ('full_period','prepaid_partial')`),
]);

export const aiRuntimePolicies = appSchema.table('ai_runtime_policies', {
  key: varchar('key', { length: 80 }).primaryKey(),
  maxRequestBytes: integer('max_request_bytes').notNull().default(1_000_000),
  maxMessages: integer('max_messages').notNull().default(128),
  maxTools: integer('max_tools').notNull().default(64),
  maxOutputTokens: integer('max_output_tokens').notNull().default(32_768),
  reservationTtlSeconds: integer('reservation_ttl_seconds').notNull().default(120),
  prepaidOnly: boolean('prepaid_only').notNull().default(true),
  customerInferenceEnabled: boolean('customer_inference_enabled').notNull().default(false),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check(
    'ai_runtime_policies_limits_check',
    sql`${table.maxRequestBytes} BETWEEN 1024 AND 5000000
      AND ${table.maxMessages} BETWEEN 1 AND 512
      AND ${table.maxTools} BETWEEN 0 AND 256
      AND ${table.maxOutputTokens} BETWEEN 1 AND 131072
      AND ${table.reservationTtlSeconds} BETWEEN 30 AND 600`,
  ),
  check('ai_runtime_policies_prepaid_only_check', sql`${table.prepaidOnly} = true`),
]);

export const aiSolutionTemplates = appSchema.table('ai_solution_templates', {
  key: varchar('key', { length: 80 }).primaryKey(),
  title: varchar('title', { length: 160 }).notNull(),
  shortDescription: text('short_description').notNull(),
  outcomes: jsonb('outcomes').$type<string[]>().notNull().default([]),
  setupSteps: jsonb('setup_steps').$type<string[]>().notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(100),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_solution_templates_enabled_sort_idx').on(table.enabled, table.sortOrder),
]);

export const aiSolutionInstances = appSchema.table('ai_solution_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  templateKey: varchar('template_key', { length: 80 }).notNull().references(() => aiSolutionTemplates.key, { onDelete: 'restrict' }),
  name: varchar('name', { length: 160 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('draft'),
  configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_solution_instances_tenant_status_idx').on(table.tenantId, table.status, table.updatedAt),
  index('ai_solution_instances_project_idx').on(table.projectId),
]);


export const aiConversations = appSchema.table('ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  solutionInstanceId: uuid('solution_instance_id').references(() => aiSolutionInstances.id, { onDelete: 'set null' }),
  connectionId: uuid('connection_id').notNull().references(() => aiProviderConnections.id, { onDelete: 'cascade' }),
  externalConversationId: varchar('external_conversation_id', { length: 240 }).notNull(),
  externalUserId: varchar('external_user_id', { length: 240 }),
  replyRecipientId: varchar('reply_recipient_id', { length: 240 }),
  replyContextId: varchar('reply_context_id', { length: 240 }),
  status: varchar('status', { length: 24 }).notNull().default('automated'),
  handoffReason: text('handoff_reason'),
  handoffAt: timestamp('handoff_at', { withTimezone: true }),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
  lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
  lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_conversations_connection_external_uidx').on(table.connectionId, table.externalConversationId),
  index('ai_conversations_tenant_status_idx').on(table.tenantId, table.status, table.updatedAt),
  index('ai_conversations_solution_idx').on(table.solutionInstanceId, table.updatedAt),
]);

export const aiMessages = appSchema.table('ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id'),
  direction: varchar('direction', { length: 16 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  providerMessageId: varchar('provider_message_id', { length: 240 }),
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  index('ai_messages_tenant_created_idx').on(table.tenantId, table.createdAt),
  uniqueIndex('ai_messages_conversation_provider_uidx').on(table.conversationId, table.providerMessageId),
]);

export const aiScheduledActions = appSchema.table('ai_scheduled_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }),
  solutionInstanceId: uuid('solution_instance_id').references(() => aiSolutionInstances.id, { onDelete: 'set null' }),
  connectionId: uuid('connection_id').notNull().references(() => aiProviderConnections.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 32 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 180 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  claimUntil: timestamp('claim_until', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(12),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  lastError: text('last_error'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_scheduled_actions_tenant_idempotency_uidx').on(table.tenantId, table.idempotencyKey),
  index('ai_scheduled_actions_due_idx').on(table.status, table.dueAt),
  index('ai_scheduled_actions_conversation_idx').on(table.conversationId, table.dueAt),
  check('ai_scheduled_actions_attempts_check', sql`${table.attempts} >= 0 AND ${table.maxAttempts} BETWEEN 1 AND 100`),
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
  rateCardId: uuid('rate_card_id').references(() => aiRateCards.id, { onDelete: 'set null' }),
  rateCardVersion: integer('rate_card_version'),
  reservedCredits: bigint('reserved_credits', { mode: 'bigint' }),
  settledCredits: bigint('settled_credits', { mode: 'bigint' }),
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

export const aiBudgetReservations = appSchema.table('ai_budget_reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').notNull().references(() => aiBudgets.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').references(() => aiRequests.id, { onDelete: 'set null' }),
  creditReservationId: uuid('credit_reservation_id').references(() => aiCreditReservations.id, { onDelete: 'set null' }),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('held'),
  reservedCredits: bigint('reserved_credits', { mode: 'bigint' }).notNull(),
  reservedRequests: bigint('reserved_requests', { mode: 'bigint' }).notNull().default(1n),
  settledCredits: bigint('settled_credits', { mode: 'bigint' }),
  settledRequests: bigint('settled_requests', { mode: 'bigint' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  releaseReason: varchar('release_reason', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_budget_reservations_budget_idempotency_uidx').on(table.budgetId, table.idempotencyKey),
  index('ai_budget_reservations_tenant_status_expiry_idx').on(table.tenantId, table.status, table.expiresAt),
  index('ai_budget_reservations_request_idx').on(table.requestId),
  index('ai_budget_reservations_credit_reservation_idx').on(table.creditReservationId),
]);


export type AiApiKey = typeof aiApiKeys.$inferSelect;
export type AiModel = typeof aiModels.$inferSelect;
export type AiRateCard = typeof aiRateCards.$inferSelect;
export type AiRuntimePolicy = typeof aiRuntimePolicies.$inferSelect;
export type AiSolutionTemplate = typeof aiSolutionTemplates.$inferSelect;
export type AiSolutionInstance = typeof aiSolutionInstances.$inferSelect;
export type AiBudget = typeof aiBudgets.$inferSelect;
export type AiBudgetReservation = typeof aiBudgetReservations.$inferSelect;
export type AiCreditReservation = typeof aiCreditReservations.$inferSelect;
