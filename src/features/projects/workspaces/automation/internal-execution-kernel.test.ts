import { executeAutomationHttpAction } from './http-action-runtime';
import { executeAutomationWorkflowDefinition } from './internal-execution-kernel';

jest.mock('./http-action-runtime', () => ({ executeAutomationHttpAction: jest.fn() }));
const httpMock = jest.mocked(executeAutomationHttpAction);
const context = { tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'manual' as const };

describe('executeAutomationWorkflowDefinition', () => {
  beforeEach(() => httpMock.mockReset());

  it('preserves internal execution behavior without mutating input', async () => {
    const input = { customer: { name: 'Ada' }, score: 10 };
    const before = JSON.parse(JSON.stringify(input));
    const result = await executeAutomationWorkflowDefinition({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: { triggerMode: 'manual' } },
      { id: 'transform-1', type: 'transform', config: { input: '{{customer.name}}', mapping: '{"greeting":"Hello {{customer.name}}"}' } },
      { id: 'condition-1', type: 'condition', config: { field: 'score', operator: 'greater_than', value: '5' } },
    ] }, input });
    expect(input).toEqual(before);
    expect(result.mode).toBe('workflow-execution');
    expect(result.data).toEqual({ customer: { name: 'Ada' }, score: 10, greeting: 'Hello Ada' });
    expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'condition-1', conditionMatched: true })]));
  });

  it('executes HTTP after transform with interpolated URL/body and exposes response data', async () => {
    httpMock.mockResolvedValue({ method: 'POST', status: 201, durationMs: 12, responseType: 'json', responsePreview: { id: 7 }, data: { id: 7 } });
    const result = await executeAutomationWorkflowDefinition({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"customerId":"42","name":"Ada"}' } },
      { id: 'http-1', type: 'http', config: { method: 'POST', url: 'https://api.example.com/customers/{{customerId}}', body: '{"name":"{{name}}"}' } },
    ] }, input: {} });
    expect(httpMock).toHaveBeenCalledWith({ method: 'POST', url: 'https://api.example.com/customers/42', body: '{"name":"Ada"}' });
    expect(result.data.http).toEqual({ nodeId: 'http-1', status: 201, body: { id: 7 } });
    expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'http-1', http: expect.objectContaining({ status: 201, responseType: 'json' }) })]));
  });

  it('skips HTTP after a false condition without dispatch', async () => {
    const result = await executeAutomationWorkflowDefinition({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'condition-1', type: 'condition', config: { field: 'score', operator: 'greater_than', value: '50' } },
      { id: 'http-1', type: 'http', config: { method: 'GET', url: 'https://example.com' } },
    ] }, input: { score: 10 } });
    expect(httpMock).not.toHaveBeenCalled();
    expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'http-1', status: 'skipped' })]));
  });

  it.each(['agent', 'future'])('blocks %s anywhere before HTTP side effects', async (type) => {
    httpMock.mockResolvedValue({ method: 'GET', status: 200, durationMs: 1, responseType: 'empty', responsePreview: null, data: null });
    await expect(executeAutomationWorkflowDefinition({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'http-1', type: 'http', config: { method: 'GET', url: 'https://example.com' } },
      { id: 'blocked-1', type, config: {} },
    ] }, input: {} })).rejects.toThrow('External or unsupported workflow action runtime is not enabled.');
    expect(httpMock).not.toHaveBeenCalled();
  });

  it('never sends a body for GET or DELETE', async () => {
    httpMock.mockResolvedValue({ method: 'GET', status: 200, durationMs: 1, responseType: 'empty', responsePreview: null, data: null });
    await executeAutomationWorkflowDefinition({ context, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'http-1', type: 'http', config: { method: 'GET', url: 'https://example.com', body: '{bad-json}' } },
    ] }, input: {} });
    expect(httpMock).toHaveBeenCalledWith({ method: 'GET', url: 'https://example.com' });
  });
});
