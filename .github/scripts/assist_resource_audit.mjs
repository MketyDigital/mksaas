import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';
const GRAPHQL = `${API}/graphql`;

export function validateDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || ![7, 31].includes(days)) throw new Error('days_must_be_7_or_31');
  return days;
}

export function redactSql(value) {
  return String(value || '')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, '?')
    .replace(/"(?:""|[^"])*"/g, '?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function isReadOnlyGraphQL(document) {
  return /^\s*query\b/i.test(String(document || ''));
}

export function resolveAssistConfigPath(configPath = '../../customer-apps/assist/wrangler.jsonc') {
  return path.isAbsolute(configPath) ? configPath : path.resolve(path.dirname(fileURLToPath(import.meta.url)), configPath);
}

export function calendarStart(now, days) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (validateDays(days) - 1)))
    .toISOString().slice(0, 10);
}

export function buildD1Query() {
  return `query AssistD1ResourceAudit($accountTag: String!, $databaseId: String!, $start: Date!, $end: Date!) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: {databaseId: $databaseId, date_geq: $start, date_leq: $end}, orderBy: [date_DESC]) {
        dimensions { date databaseId }
        sum { readQueries writeQueries rowsRead rowsWritten queryBatchResponseBytes }
        quantiles { queryBatchTimeMsP90 }
      }
      d1StorageAdaptiveGroups(limit: 10000, filter: {databaseId: $databaseId, date_geq: $start, date_leq: $end}, orderBy: [date_DESC]) {
        dimensions { date databaseId } max { databaseSizeBytes }
      }
      topQueriesByRowsRead: d1QueriesAdaptiveGroups(limit: 50, filter: {databaseId: $databaseId, date_geq: $start, date_leq: $end}, orderBy: [sum_rowsRead_DESC]) {
        dimensions { databaseId query } count sum { rowsRead rowsWritten } avg { queryDurationMs rowsRead rowsWritten }
      }
      topQueriesByRowsWritten: d1QueriesAdaptiveGroups(limit: 50, filter: {databaseId: $databaseId, date_geq: $start, date_leq: $end}, orderBy: [sum_rowsWritten_DESC]) {
        dimensions { databaseId query } count sum { rowsRead rowsWritten } avg { queryDurationMs rowsRead rowsWritten }
      }
    } }
  }`;
}

export function buildWorkerQuery() {
  return `query AssistWorkerResourceAudit($accountTag: String!, $scriptName: String!, $start: String!, $end: String!) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      workersInvocationsAdaptive(limit: 1000, filter: {scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end}) {
        dimensions { scriptName status }
        sum { requests errors subrequests }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    } }
  }`;
}

export function buildQueueQuery() {
  return `query AssistQueueResourceAudit($accountTag: String!, $queueId: String!, $start: Time!, $end: Time!) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      queueMessageOperationsAdaptiveGroups(limit: 1000, filter: {queueId: $queueId, datetime_geq: $start, datetime_leq: $end}) {
        dimensions { actionType consumerType outcome }
        count sum { billableOperations bytes } avg { lagTime retryCount } max { messageSize }
      }
      queueBacklogAdaptiveGroups(limit: 1000, filter: {queueId: $queueId, datetime_geq: $start, datetime_leq: $end}) {
        avg { messages bytes }
      }
      queueConsumerMetricsAdaptiveGroups(limit: 1000, filter: {queueId: $queueId, datetime_geq: $start, datetime_leq: $end}) {
        avg { concurrency }
      }
    } }
  }`;
}

export function buildDurableObjectQuery() {
  return `query AssistDurableObjectResourceAudit($accountTag: String!, $namespaceId: String!, $start: Date!, $end: Date!) {
    viewer { accounts(filter: {accountTag: $accountTag}) {
      durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: {namespaceId: $namespaceId, date_geq: $start, date_leq: $end}) {
        sum { requests responseBodySize }
      }
      durableObjectsPeriodicGroups(limit: 1000, filter: {namespaceId: $namespaceId, date_geq: $start, date_leq: $end}) {
        sum { cpuTime }
      }
      durableObjectsStorageGroups(limit: 1000, filter: {namespaceId: $namespaceId, date_geq: $start, date_leq: $end}) {
        max { storedBytes }
      }
    } }
  }`;
}

export function sanitizeGraphQLError(message) {
  return String(message || 'graphql_error')
    .replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi, '[redacted]')
    .replace(/\b[a-f0-9]{32}\b/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function statusError(error) {
  return {
    ok: false,
    status: Number(error?.status || 0) || undefined,
    codes: Array.isArray(error?.codes) ? error.codes.slice(0, 5) : [],
    details: Array.isArray(error?.details) ? error.details.slice(0, 3).map(sanitizeGraphQLError) : [],
    message: String(error?.message || 'request_failed').replace(/[\r\n]/g, ' ').slice(0, 180),
  };
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(`cloudflare_http_${response.status}`);
    error.status = response.status;
    error.codes = data.errors?.map((item) => item.code).filter(Boolean);
    throw error;
  }
  return data;
}

async function restGet(resourcePath, token) {
  return requestJson(`${API}${resourcePath}`, token);
}

async function graph(query, variables, token) {
  if (!isReadOnlyGraphQL(query)) throw new Error('audit_graphql_must_be_query');
  const response = await requestJson(GRAPHQL, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (response.errors?.length) {
    const error = new Error(`graphql_rejected_${query.match(/\bquery\s+(\w+)/)?.[1] || 'audit_query'}`);
    error.codes = response.errors.map((item) => item.extensions?.code).filter(Boolean);
    error.details = response.errors.map((item) => sanitizeGraphQLError(item.message)).filter(Boolean);
    throw error;
  }
  return response.data?.viewer?.accounts?.[0] || {};
}

async function optional(fn) {
  try { return { ok: true, data: await fn() }; }
  catch (error) { return statusError(error); }
}

export function queueNamesFromConfig(config) {
  const names = new Set();
  for (const consumer of config.queues?.consumers || []) {
    if (consumer.queue) names.add(consumer.queue);
    if (consumer.dead_letter_queue) names.add(consumer.dead_letter_queue);
  }
  for (const producer of config.queues?.producers || []) if (producer.queue) names.add(producer.queue);
  return [...names].sort();
}

export function matchAssistDurableObjectNamespaces(resources, config) {
  const bindings = config.durable_objects?.bindings || [];
  return bindings.map((binding) => {
    const matches = (resources || []).filter((item) => item.script === config.name && item.class === binding.class_name && item.id);
    if (matches.length !== 1) throw new Error(`assist_durable_object_namespace_not_unique:${binding.class_name}`);
    return { className: binding.class_name, namespaceId: matches[0].id };
  });
}

async function resolveDatabase(token, account) {
  const response = await restGet(`/accounts/${account}/d1/database?name=mkety-assist-prod&per_page=100`, token);
  const matches = (response.result || []).filter((db) => db.name === 'mkety-assist-prod');
  if (matches.length !== 1) throw new Error('assist_d1_database_not_unique');
  return {
    id: matches[0].uuid,
    name: matches[0].name,
    tables: matches[0].num_tables ?? null,
    currentStorageBytes: matches[0].file_size ?? null,
  };
}

async function listAssistQueues(token, account, configuredNames) {
  const response = await restGet(`/accounts/${account}/queues?per_page=100`, token);
  const resources = (response.result || []);
  const byName = new Map(resources.map((queue) => [queue.queue_name, queue]));
  return configuredNames.map((name) => {
    const item = byName.get(name);
    return item ? { name, id: item.queue_id, exists: true } : { name, id: null, exists: false };
  });
}

async function listAssistDurableObjectNamespaces(token, account, config) {
  const response = await restGet(`/accounts/${account}/workers/durable_objects/namespaces?per_page=100`, token);
  return matchAssistDurableObjectNamespaces(response.result || [], config);
}

function redactMetricQueries(result) {
  const clone = structuredClone(result);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (value.dimensions?.query) value.dimensions.query = redactSql(value.dimensions.query);
    Object.values(value).forEach(visit);
  };
  visit(clone);
  return clone;
}

export async function runAudit({ token, account, days, configPath = '../../customer-apps/assist/wrangler.jsonc', now = new Date() }) {
  if (!token || !/^[a-f0-9]{32}$/i.test(String(account || ''))) throw new Error('cloudflare_credentials_invalid');
  const windowDays = validateDays(days);
  const config = JSON.parse(fs.readFileSync(resolveAssistConfigPath(configPath), 'utf8'));
  if (config.name !== 'mkety-assist') throw new Error('assist_worker_binding_not_confirmed');
  const db = await resolveDatabase(token, account);
  const queueResources = await listAssistQueues(token, account, queueNamesFromConfig(config));
  const missingQueues = queueResources.filter((item) => !item.exists).map((item) => item.name);
  const end = now.toISOString();
  const start = new Date(now.getTime() - windowDays * 86400000).toISOString();
  const startDate = calendarStart(now, windowDays);
  const endDate = now.toISOString().slice(0, 10);

  const [d1Metrics, workerMetrics, durableObjectMetrics] = await Promise.all([
    optional(async () => redactMetricQueries(await graph(buildD1Query(), { accountTag: account, databaseId: db.id, start: startDate, end: endDate }, token))),
    optional(() => graph(buildWorkerQuery(), { accountTag: account, scriptName: config.name, start, end }, token)),
    optional(async () => {
      const namespaces = await listAssistDurableObjectNamespaces(token, account, config);
      const classes = await Promise.all(namespaces.map(async ({ className, namespaceId }) => ({
        className,
        analytics: await optional(() => graph(buildDurableObjectQuery(), { accountTag: account, namespaceId, start: startDate, end: endDate }, token)),
      })));
      return classes;
    }),
  ]);

  const queueMetrics = {};
  for (const queue of queueResources.filter((item) => item.exists)) {
    const [analytics, current] = await Promise.all([
      optional(() => graph(buildQueueQuery(), { accountTag: account, queueId: queue.id, start, end }, token)),
      optional(async () => {
        const response = await restGet(`/accounts/${account}/queues/${encodeURIComponent(queue.id)}/metrics`, token);
        const value = response.result || {};
        return {
          backlogCount: value.backlog_count ?? null,
          backlogBytes: value.backlog_bytes ?? null,
          oldestMessageTimestampMs: value.oldest_message_timestamp_ms ?? null,
        };
      }),
    ]);
    queueMetrics[queue.name] = { id: queue.id, analytics, current };
  }

  return {
    generatedAt: now.toISOString(),
    windowDays,
    windows: {
      exactStartUtc: start,
      endUtc: end,
      calendarStartUtc: startDate,
      calendarEndUtc: endDate,
      note: 'Worker and Queue metrics use an exact rolling timestamp window; D1 and Durable Object analytics use UTC calendar dates.'
    },
    scope: {
      application: config.name,
      database: db,
      configuredQueues: queueResources,
      durableObjectClasses: config.durable_objects?.bindings?.map((binding) => binding.class_name) || [],
      containersConfigured: Boolean(config.containers?.length),
      containersNote: config.containers?.length ? 'Container bindings found in Assist Wrangler config; inspect configuration before assigning account Container usage.' : 'No Containers binding is declared by the Assist Worker config; this report does not attribute account-wide Containers usage to Assist.',
    },
    metrics: {
      d1: d1Metrics,
      worker: workerMetrics,
      queues: queueMetrics,
      durableObjects: durableObjectMetrics,
    },
    auditNotes: [
      'Read-only Cloudflare REST GET and GraphQL query operations only; no D1 SQL or message contents are fetched.',
      'D1 query signatures are value-redacted before the report is written.',
      'Configured queues missing from the Cloudflare queue list are reported, not created or changed.',
      ...(missingQueues.length ? [`Queue resources missing from Cloudflare inventory: ${missingQueues.join(', ')}`] : []),
      'Durable Object usage analytics shows requests, periodic CPU and storage by Assist namespace/class. Cloudflare usage data does not expose a durable-object instance lifetime list; SettlementJournal is request driven with no application WebSocket or timer loop.',
      'The report does not change queue retry policy, cron cadence, database indexes, or Worker settings.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = await runAudit({
      token: process.env.CLOUDFLARE_API_TOKEN || process.env.MKETY_ASSIST_CF_SAAS_TOKEN,
      account: process.env.CLOUDFLARE_ACCOUNT_ID,
      days: process.env.AUDIT_WINDOW_DAYS,
    });
    const output = process.env.REPORT_PATH || 'assist-cloudflare-resource-audit.json';
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Read-only Assist Cloudflare usage report written to ${path.basename(output)}`);
  } catch (error) {
    console.error(`Assist Cloudflare audit failed: ${String(error?.message || 'unexpected_error').replace(/[\r\n]/g, ' ').slice(0, 180)}`);
    process.exitCode = 1;
  }
}

