import { runAgentForAutomation } from '@/features/ai/lib/agent-runtime';
import { executeAutomationAgentAction } from './agent-action-runtime';

jest.mock('@/features/ai/lib/agent-runtime', () => ({ runAgentForAutomation: jest.fn() }));
const runMock = jest.mocked(runAgentForAutomation);

describe('executeAutomationAgentAction', () => {
  beforeEach(() => runMock.mockReset());
  it('executes immutable published metadata with tools disabled and bounded output', async () => {
    runMock.mockResolvedValue({ text: 'A'.repeat(5000), usage: { totalTokens: 12 } });
    const result = await executeAutomationAgentAction({ tenantId: 't1', projectId: 'p1', prompt: 'Summarize', dependency: { nodeId: 'agent-1', agentId: 'a1', versionId: 'v2', version: 2, name: 'Writer', instructions: 'Be concise', provider: 'platform', model: null, config: null } });
    expect(runMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', tenantId: 't1', projectId: 'p1', name: 'Writer' }), [{ role: 'user', content: 'Summarize' }], { tools: 'disabled' });
    expect(result.outputPreview).toHaveLength(4096);
    expect(result).toEqual(expect.objectContaining({ agentId: 'a1', versionId: 'v2', version: 2, usage: { totalTokens: 12 } }));
  });
  it('sanitizes provider failures', async () => {
    runMock.mockRejectedValue(new Error('secret-key-123'));
    await expect(executeAutomationAgentAction({ tenantId: 't1', projectId: 'p1', prompt: 'x', dependency: { nodeId: 'n', agentId: 'a', versionId: 'v', version: 1, name: 'A', instructions: null, provider: 'platform', model: null, config: null } })).rejects.toThrow('Automation Agent action failed.');
  });
});
