import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildD1Query,
  buildDurableObjectQuery,
  buildQueueQuery,
  buildWorkerQuery,
  calendarStart,
  isReadOnlyGraphQL,
  matchAssistDurableObjectNamespaces,
  queueNamesFromConfig,
  redactSql,
  resolveAssistConfigPath,
  sanitizeGraphQLError,
  validateDays,
} from './assist_resource_audit.mjs';

test('accepts only the offered bounded analytics windows', () => {
  assert.equal(validateDays('7'), 7);
  assert.equal(validateDays('31'), 31);
  assert.throws(() => validateDays('32'), /days_must_be_7_or_31/);
  assert.throws(() => validateDays('7;delete'), /days_must_be_7_or_31/);
});

test('date-based D1 and DO window includes the selected UTC calendar dates', () => {
  assert.equal(calendarStart(new Date('2026-10-19T14:00:00Z'), 7), '2026-10-13');
});

test('query signatures are value-redacted and length-bounded', () => {
  assert.equal(redactSql("SELECT token FROM t WHERE id='private' AND n=123"), 'SELECT token FROM t WHERE id=? AND n=?');
  assert.ok(redactSql('x'.repeat(1000)).length <= 500);
});

test('GraphQL schema errors are bounded and redact account identifiers', () => {
  const message = sanitizeGraphQLError("Unknown field for account 0123456789abcdef0123456789abcdef");
  assert.equal(message, 'Unknown field for account [redacted]');
  assert.ok(sanitizeGraphQLError('x'.repeat(500)).length <= 180);
});

test('every generated analytics document is a read-only GraphQL query', () => {
  for (const query of [buildD1Query(), buildWorkerQuery(), buildQueueQuery(), buildDurableObjectQuery()]) {
    assert.equal(isReadOnlyGraphQL(query), true);
    assert.doesNotMatch(query, /\bmutation\b/i);
  }
});

test('D1 metrics isolate mkety-assist-prod and surface top read and write signatures', () => {
  const query = buildD1Query();
  assert.match(query, /databaseId: \$databaseId/);
  assert.match(query, /topQueriesByRowsRead: d1QueriesAdaptiveGroups/);
  assert.match(query, /topQueriesByRowsWritten: d1QueriesAdaptiveGroups/);
  assert.match(query, /rowsRead rowsWritten/);
  assert.match(query, /queryBatchTimeMsP90/);
  assert.doesNotMatch(query, /sum \{[^}]*queryBatchTimeMs/);
});

test('Queue analytics filter each Assist queue and aggregate the whole window, including retries and concurrency', () => {
  const query = buildQueueQuery();
  assert.match(query, /queueId: \$queueId/);
  assert.match(query, /avg \{ lagTime retryCount \}/);
  assert.match(query, /avg \{ concurrency \}/);
  assert.match(query, /queueBacklogAdaptiveGroups/);
  assert.doesNotMatch(query, /queuesBacklogAdaptiveGroups|queueID|datetimeHour|datetimeMinute/);
});

test('Durable Object metrics stay scoped to Assist and avoid unsupported dimensions', () => {
  const query = buildDurableObjectQuery();
  assert.match(query, /namespaceId: \$namespaceId/);
  assert.doesNotMatch(query, /scriptName: \$scriptName/);
  assert.match(query, /sum \{ requests responseBodySize \}/);
  assert.match(query, /sum \{ cpuTime \}/);
  assert.match(query, /max \{ storedBytes \}/);
  assert.doesNotMatch(query, /className/);
});

test('Durable Object namespace resolution matches only the configured Assist script and class', () => {
  const config = { name: 'mkety-assist', durable_objects: { bindings: [{ class_name: 'SettlementJournal' }] } };
  const resources = [
    { id: 'wrong-script', script: 'other-worker', class: 'SettlementJournal' },
    { id: 'wrong-class', script: 'mkety-assist', class: 'OtherClass' },
    { id: 'assist-journal', script: 'mkety-assist', class: 'SettlementJournal' },
  ];
  assert.deepEqual(matchAssistDurableObjectNamespaces(resources, config), [
    { className: 'SettlementJournal', namespaceId: 'assist-journal' },
  ]);
  assert.throws(() => matchAssistDurableObjectNamespaces(resources.slice(0, 2), config), /namespace_not_unique/);
  assert.throws(() => matchAssistDurableObjectNamespaces([...resources, resources[2]], config), /namespace_not_unique/);
});

test('Assist config identifies its own Worker, queues and Durable Object without Containers', () => {
  const configPath = resolveAssistConfigPath();
  assert.equal(fs.existsSync(configPath), true);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.name, 'mkety-assist');
  assert.deepEqual(queueNamesFromConfig(config), [
    'mkety-assist-inbound',
    'mkety-assist-inbound-dlq',
    'mkety-assist-replies',
    'mkety-assist-replies-dlq',
  ]);
  assert.deepEqual(config.durable_objects.bindings.map((binding) => binding.class_name), ['SettlementJournal']);
  assert.equal(Boolean(config.containers?.length), false);
});

test('workflow only reads secrets in the main-branch manual audit job and runs no deploy step', () => {
  const workflow = fs.readFileSync(new URL('../workflows/mkety-assist-cloudflare-resource-audit.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /wrangler deploy|d1 execute|queues create|\bDELETE\s+.*cloudflare/i);
  assert.doesNotMatch(workflow, /REPORT_PATH:\s*\$\{\{\s*runner\.temp/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
});

