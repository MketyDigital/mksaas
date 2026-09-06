import { executeAutomationAgentAction } from './agent-action-runtime';
import { executeAutomationHttpAction } from './http-action-runtime';
import { executeAutomationWorkflowDefinition } from './internal-execution-kernel';

jest.mock('./agent-action-runtime', () => ({ executeAutomationAgentAction: jest.fn() }));
jest.mock('./http-action-runtime', () => ({ executeAutomationHttpAction: jest.fn() }));
const agentMock = jest.mocked(executeAutomationAgentAction);
const httpMock = jest.mocked(executeAutomationHttpAction);
const context = { tenantId: 'tenant-1', projectId: 'project-1', workflowId: 'workflow-1', triggerType: 'manual' as const };
const dependency = { nodeId: 'agent-1', agentId: 'a1', versionId: 'v2', version: 2, name: 'Writer', instructions: 'Write', provider: 'platform', model: null, config: null };

describe('executeAutomationWorkflowDefinition', () => {
  beforeEach(() => { agentMock.mockReset(); httpMock.mockReset(); });

  it('executes transform then Agent and exposes Agent output to later transforms without mutating input', async () => {
    agentMock.mockResolvedValue({ agentId: 'a1', versionId: 'v2', version: 2, provider: 'platform', model: null, durationMs: 8, text: 'Summary Ada', outputPreview: 'Summary Ada' });
    const input = { customer: { name: 'Ada' } }; const before = JSON.parse(JSON.stringify(input));
    const result = await executeAutomationWorkflowDefinition({ context, dependencies: { agents: { 'agent-1': dependency } }, definition: { nodes: [
      { id: 'trigger-1', type: 'trigger', config: {} },
      { id: 'transform-1', type: 'transform', config: { input: '', mapping: '{"name":"{{customer.name}}"}' } },
      { id: 'agent-1', type: 'agent', config: { agentId: 'a1', prompt: 'Summarize {{name}}' } },
      { id: 'transform-2', type: 'transform', config: { input: '', mapping: '{"final":"{{agent.text}}"}' } },
    ] }, input });
    expect(agentMock).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Summarize Ada', dependency }));
    expect(result.data).toEqual(expect.objectContaining({ final: 'Summary Ada', agent: { nodeId: 'agent-1', agentId: 'a1', versionId: 'v2', version: 2, text: 'Summary Ada' } }));
    expect(input).toEqual(before);
  });

  it('lets Agent consume current HTTP output', async () => {
    httpMock.mockResolvedValue({ method: 'GET', status: 200, durationMs: 2, responseType: 'json', responsePreview: { answer: 42 }, data: { answer: 42 } });
    agentMock.mockResolvedValue({ agentId: 'a1', versionId: 'v2', version: 2, provider: 'platform', model: null, durationMs: 3, text: '42', outputPreview: '42' });
    await executeAutomationWorkflowDefinition({ context, dependencies: { agents: { 'agent-1': dependency } }, definition: { nodes: [
      { id: 'http-1', type: 'http', config: { method: 'GET', url: 'https://example.com' } },
      { id: 'agent-1', type: 'agent', config: { agentId: 'a1', prompt: 'Read {{http.body}}' } },
    ] }, input: {} });
    expect(agentMock).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Read {"answer":42}' }));
  });

  it('skips Agent after false condition without dispatch', async () => {
    const result = await executeAutomationWorkflowDefinition({ context, dependencies: { agents: { 'agent-1': dependency } }, definition: { nodes: [
      { id: 'condition-1', type: 'condition', config: { field: 'score', operator: 'greater_than', value: '50' } },
      { id: 'agent-1', type: 'agent', config: { agentId: 'a1', prompt: 'x' } },
    ] }, input: { score: 10 } });
    expect(agentMock).not.toHaveBeenCalled();
    expect(result.steps).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: 'agent-1', status: 'skipped' })]));
  });

  it('blocks unsupported or unresolved Agent dependencies before any external side effect', async () => {
    await expect(executeAutomationWorkflowDefinition({ context, dependencies: { agents: {} }, definition: { nodes: [
      { id: 'http-1', type: 'http', config: { method: 'GET', url: 'https://example.com' } },
      { id: 'agent-1', type: 'agent', config: { agentId: 'a1', prompt: 'x' } },
    ] }, input: {} })).rejects.toThrow('Resolved Agent dependency is required before workflow execution.');
    expect(httpMock).not.toHaveBeenCalled(); expect(agentMock).not.toHaveBeenCalled();
    await expect(executeAutomationWorkflowDefinition({ context, dependencies: { agents: { 'agent-1': dependency } }, definition: { nodes: [{ id: 'future-1', type: 'future', config: {} }, { id: 'agent-1', type: 'agent', config: { agentId: 'a1', prompt: 'x' } }] }, input: {} })).rejects.toThrow('External or unsupported workflow action runtime is not enabled.');
    expect(agentMock).not.toHaveBeenCalled();
  });
});
