import { createHmac } from 'node:crypto';

import { handleAutomationWebhookIngress } from './webhook-ingress';

const secret = 'mkety_test_signing_secret';
const endpoint = { id: 'endpoint-row', endpointId: 'public-endpoint', tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', status: 'active', secretCiphertext: 'ciphertext' };
const workflow = { id: 'workflow-1', tenantId: 'tenant-1', projectId: 'project-1', status: 'active', triggerType: 'webhook', version: '7', definition: { nodes: [{ id: 'trigger-1', type: 'trigger', config: { triggerMode: 'webhook' } }] } };

function requestDouble(body: string, headers: Record<string, string>) {
  const values = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  let consumed = false;
  return {
    headers: {
      get(name: string) { return values.get(name.toLowerCase()) ?? null; },
      set(name: string, value: string) { values.set(name.toLowerCase(), value); },
    },
    body: {
      getReader() {
        return {
          async read() {
            if (consumed) return { done: true as const, value: undefined };
            consumed = true;
            return { done: false as const, value: Buffer.from(body) };
          },
          async cancel() { return undefined; },
        };
      },
    },
  } as unknown as Request;
}

function signedRequest(body = '{"customer":{"id":1}}', eventId = 'evt-1') {
  const digest = createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
  return requestDouble(body, { 'content-type': 'application/json', 'x-mkety-signature': `sha256=${digest}`, 'x-mkety-event-id': eventId });
}

function makeDependencies() {
  return {
    findEndpoint: jest.fn().mockResolvedValue(endpoint),
    decryptSecret: jest.fn().mockReturnValue(secret),
    findWorkflow: jest.fn().mockResolvedValue(workflow),
    resolveDependencies: jest.fn().mockResolvedValue({ ready: true, blockers: [], agents: {} }),
    admitDelivery: jest.fn().mockResolvedValue({ status: 'admitted', deliveryId: 'delivery-1' }),
    executeWorkflow: jest.fn().mockImplementation(async ({ onRunCreated }) => { await onRunCreated?.('run-1'); return { runId: 'run-1', output: { mode: 'workflow-execution', data: {}, steps: [], workflowVersion: '7' } }; }),
    associateDeliveryRun: jest.fn().mockResolvedValue(undefined),
    markDeliveryFailure: jest.fn().mockResolvedValue(undefined),
  };
}

describe('handleAutomationWebhookIngress', () => {
  it('authenticates, admits and executes a webhook through the shared workflow service', async () => {
    const dependencies = makeDependencies();
    const result = await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, dependencies);

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(dependencies.admitDelivery).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt-1', eventIdSource: 'external', webhookEndpointId: 'endpoint-row' }));
    expect(dependencies.executeWorkflow).toHaveBeenCalledWith(expect.objectContaining({ triggerType: 'webhook', input: { customer: { id: 1 } } }));
    expect(dependencies.associateDeliveryRun).toHaveBeenCalledWith({ deliveryId: 'delivery-1', workflowRunId: 'run-1' });
  });

  it('rejects unknown endpoints and bad signatures before workflow lookup or admission', async () => {
    const missing = makeDependencies();
    missing.findEndpoint.mockResolvedValue(null);
    await expect(handleAutomationWebhookIngress({ endpointId: 'missing', request: signedRequest() }, missing)).resolves.toEqual({ status: 404, body: { error: 'Webhook endpoint not found.' } });
    expect(missing.findWorkflow).not.toHaveBeenCalled();

    const invalid = makeDependencies();
    const request = signedRequest();
    request.headers.set('x-mkety-signature', `sha256=${'0'.repeat(64)}`);
    await expect(handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request }, invalid)).resolves.toEqual({ status: 401, body: { error: 'Webhook authentication failed.' } });
    expect(invalid.findWorkflow).not.toHaveBeenCalled();
    expect(invalid.admitDelivery).not.toHaveBeenCalled();
  });

  it('rejects invalid media, invalid JSON, inactive workflows and non-ready definitions without a run', async () => {
    const media = makeDependencies();
    const mediaRequest = signedRequest();
    mediaRequest.headers.set('content-type', 'text/plain');
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: mediaRequest }, media)).status).toBe(415);

    const invalidJson = makeDependencies();
    const badBody = '{bad';
    const digest = createHmac('sha256', secret).update(Buffer.from(badBody)).digest('hex');
    const badRequest = requestDouble(badBody, { 'content-type': 'application/json', 'x-mkety-signature': `sha256=${digest}` });
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: badRequest }, invalidJson)).status).toBe(400);

    const inactive = makeDependencies();
    inactive.findWorkflow.mockResolvedValue({ ...workflow, status: 'draft' });
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, inactive)).status).toBe(422);
    expect(inactive.executeWorkflow).not.toHaveBeenCalled();

    const mismatch = makeDependencies();
    mismatch.findWorkflow.mockResolvedValue({ ...workflow, definition: { nodes: [{ id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } }] } });
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, mismatch)).status).toBe(422);
    expect(mismatch.admitDelivery).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies before authentication or workflow lookup', async () => {
    const dependencies = makeDependencies();
    const request = requestDouble('x', { 'content-type': 'application/json', 'content-length': String(256 * 1024 + 1) });
    const result = await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request }, dependencies);
    expect(result).toEqual({ status: 413, body: { error: 'Webhook payload is too large.' } });
    expect(dependencies.decryptSecret).not.toHaveBeenCalled();
    expect(dependencies.findWorkflow).not.toHaveBeenCalled();
  });

  it('returns conflict for duplicate or busy deliveries and sanitizes execution failures', async () => {
    const duplicate = makeDependencies();
    duplicate.admitDelivery.mockResolvedValue({ status: 'duplicate' });
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, duplicate)).status).toBe(409);
    expect(duplicate.executeWorkflow).not.toHaveBeenCalled();

    const busy = makeDependencies();
    busy.admitDelivery.mockResolvedValue({ status: 'busy', deliveryId: 'delivery-2' });
    expect((await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, busy)).status).toBe(409);

    const failed = makeDependencies();
    failed.executeWorkflow.mockRejectedValue(new Error('provider secret diagnostic'));
    const result = await handleAutomationWebhookIngress({ endpointId: 'public-endpoint', request: signedRequest() }, failed);
    expect(result).toEqual({ status: 500, body: { error: 'Webhook execution failed.' } });
    expect(failed.markDeliveryFailure).toHaveBeenCalledWith({ deliveryId: 'delivery-1', errorCode: 'execution_failed' });
    expect(JSON.stringify(result)).not.toContain('provider secret diagnostic');
  });
});
