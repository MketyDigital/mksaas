import { generateText } from 'ai';
import { runAgentForAutomation } from './agent-runtime';

jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), stepCountIs: jest.fn(() => 'stop') }));
jest.mock('./provider', () => ({ getAIModel: jest.fn(() => 'default'), getAIProvider: jest.fn(() => jest.fn(() => 'model')) }));
jest.mock('./knowledge-context', () => ({ buildKnowledgeContext: jest.fn(async () => '') }));
jest.mock('./agent-tools', () => ({ createAgentTools: jest.fn(() => ({ dangerous: {} })) }));
const generateMock = jest.mocked(generateText);

describe('runAgentForAutomation', () => {
  it('uses non-streaming generation with tools disabled', async () => {
    generateMock.mockResolvedValue({ text: 'done', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } } as never);
    const result = await runAgentForAutomation({ id: 'a1', tenantId: 't1', projectId: 'p1', name: 'Agent', instructions: 'Help', provider: 'platform', model: null, status: 'published', config: '{"tools":["dangerous"]}' }, [{ role: 'user', content: 'Hello' }], { tools: 'disabled' });
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ tools: {} }));
    expect(result).toEqual({ text: 'done', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } });
  });
});
