import { createWorkflowWebhookEndpoint, disableWorkflowWebhookEndpoint, getWorkflowWebhookEndpoint, rotateWorkflowWebhookSecret } from './webhook-endpoints';

function makeDependencies() {
  return {
    findWorkflow: jest.fn(),
    findEndpoint: jest.fn(),
    insertEndpoint: jest.fn(),
    updateEndpoint: jest.fn(),
  };
}

const scope = { tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1' };

describe('workflow webhook endpoint management', () => {
  it('creates credentials only for a same-scope webhook workflow and persists no raw secret', async () => {
    const dependencies = makeDependencies();
    dependencies.findWorkflow.mockResolvedValue({ id: 'workflow-1', triggerType: 'webhook' });
    dependencies.insertEndpoint.mockResolvedValue(undefined);

    const result = await createWorkflowWebhookEndpoint(scope, dependencies);

    expect(result.endpointId).toHaveLength(48);
    expect(result.secret.length).toBeGreaterThanOrEqual(32);
    expect(dependencies.insertEndpoint).toHaveBeenCalledWith(expect.objectContaining({ ...scope, endpointId: result.endpointId, secretHash: expect.any(String), status: 'active' }));
    expect(JSON.stringify(dependencies.insertEndpoint.mock.calls)).not.toContain(result.secret);
  });

  it('rejects missing or non-webhook workflows', async () => {
    const dependencies = makeDependencies();
    dependencies.findWorkflow.mockResolvedValue(null);
    await expect(createWorkflowWebhookEndpoint(scope, dependencies)).rejects.toThrow('Workflow not found.');
    dependencies.findWorkflow.mockResolvedValue({ id: 'workflow-1', triggerType: 'manual' });
    await expect(createWorkflowWebhookEndpoint(scope, dependencies)).rejects.toThrow('Workflow must use the webhook trigger before creating an endpoint.');
  });

  it('rotates and disables only an existing same-scope endpoint without exposing hashes from reads', async () => {
    const dependencies = makeDependencies();
    dependencies.findEndpoint.mockResolvedValue({ id: 'endpoint-row', endpointId: 'public-endpoint', status: 'active', secretHash: 'hidden' });
    dependencies.updateEndpoint.mockResolvedValue(undefined);

    const metadata = await getWorkflowWebhookEndpoint(scope, dependencies);
    expect(metadata).toEqual({ endpointId: 'public-endpoint', status: 'active' });
    expect(metadata).not.toHaveProperty('secretHash');

    const rotated = await rotateWorkflowWebhookSecret({ ...scope, endpointId: 'public-endpoint' }, dependencies);
    expect(rotated.secret.length).toBeGreaterThanOrEqual(32);
    expect(dependencies.updateEndpoint).toHaveBeenCalledWith('endpoint-row', expect.objectContaining({ secretHash: expect.any(String), rotatedAt: expect.any(Date), updatedAt: expect.any(Date) }));

    await disableWorkflowWebhookEndpoint({ ...scope, endpointId: 'public-endpoint' }, dependencies);
    expect(dependencies.updateEndpoint).toHaveBeenCalledWith('endpoint-row', expect.objectContaining({ status: 'disabled', updatedAt: expect.any(Date) }));
  });
});
