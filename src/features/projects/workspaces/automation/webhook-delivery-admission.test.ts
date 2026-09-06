import { admitWebhookDelivery, associateWebhookDeliveryRun, markWebhookDeliveryFailure } from './webhook-delivery-admission';

function makeDependencies() {
  return {
    insertDelivery: jest.fn(),
    hasActiveRun: jest.fn(),
    updateDelivery: jest.fn(),
  };
}

const input = {
  tenantId: 'tenant-1',
  projectId: 'project-1',
  workflowId: 'workflow-1',
  webhookEndpointId: 'endpoint-row',
  eventId: 'evt-1',
  eventIdSource: 'external' as const,
  payloadHash: 'a'.repeat(64),
};

describe('webhook delivery admission', () => {
  it('atomically admits a unique delivery and marks it admitted when workflow is idle', async () => {
    const dependencies = makeDependencies();
    dependencies.insertDelivery.mockResolvedValue({ id: 'delivery-1' });
    dependencies.hasActiveRun.mockResolvedValue(false);

    await expect(admitWebhookDelivery(input, dependencies)).resolves.toEqual({ status: 'admitted', deliveryId: 'delivery-1' });
    expect(dependencies.updateDelivery).toHaveBeenCalledWith('delivery-1', expect.objectContaining({ status: 'admitted', admittedAt: expect.any(Date) }));
  });

  it('maps a database conflict to duplicate without checking workflow concurrency', async () => {
    const dependencies = makeDependencies();
    dependencies.insertDelivery.mockResolvedValue(null);

    await expect(admitWebhookDelivery(input, dependencies)).resolves.toEqual({ status: 'duplicate' });
    expect(dependencies.hasActiveRun).not.toHaveBeenCalled();
  });

  it('retains a unique delivery as busy when the workflow already has an active run', async () => {
    const dependencies = makeDependencies();
    dependencies.insertDelivery.mockResolvedValue({ id: 'delivery-2' });
    dependencies.hasActiveRun.mockResolvedValue(true);

    await expect(admitWebhookDelivery(input, dependencies)).resolves.toEqual({ status: 'busy', deliveryId: 'delivery-2' });
    expect(dependencies.updateDelivery).toHaveBeenCalledWith('delivery-2', expect.objectContaining({ status: 'busy', errorCode: 'workflow_busy' }));
  });

  it('associates runs and records bounded failure codes through scoped helpers', async () => {
    const dependencies = makeDependencies();
    await associateWebhookDeliveryRun({ deliveryId: 'delivery-1', workflowRunId: 'run-1' }, dependencies);
    expect(dependencies.updateDelivery).toHaveBeenCalledWith('delivery-1', { workflowRunId: 'run-1' });

    await markWebhookDeliveryFailure({ deliveryId: 'delivery-1', errorCode: 'execution_failed' }, dependencies);
    expect(dependencies.updateDelivery).toHaveBeenCalledWith('delivery-1', { status: 'failed', errorCode: 'execution_failed' });
  });
});
