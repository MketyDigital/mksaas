import { getTableConfig } from 'drizzle-orm/pg-core';

import { workflowWebhookDeliveries } from './workflow-webhook-deliveries';
import { workflowWebhookEndpoints } from './workflow-webhook-endpoints';

describe('automation webhook persistence schema', () => {
  it('defines scoped webhook endpoint persistence with a unique public endpoint id', () => {
    const config = getTableConfig(workflowWebhookEndpoints);
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(columnNames).toEqual(expect.arrayContaining([
      'id',
      'tenant_id',
      'project_id',
      'workflow_id',
      'endpoint_id',
      'secret_hash',
      'status',
      'created_at',
      'updated_at',
      'rotated_at',
    ]));
    expect(indexNames).toContain('workflow_webhook_endpoints_endpoint_id_idx');
  });

  it('defines delivery admission persistence with atomic endpoint/event uniqueness', () => {
    const config = getTableConfig(workflowWebhookDeliveries);
    const columnNames = config.columns.map((column) => column.name);
    const indexNames = config.indexes.map((index) => index.config.name);

    expect(columnNames).toEqual(expect.arrayContaining([
      'id',
      'tenant_id',
      'project_id',
      'workflow_id',
      'webhook_endpoint_id',
      'event_id',
      'event_id_source',
      'payload_hash',
      'status',
      'workflow_run_id',
      'error_code',
      'received_at',
      'admitted_at',
    ]));
    expect(indexNames).toContain('workflow_webhook_deliveries_event_identity_idx');
  });
});
