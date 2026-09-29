import { generateText } from 'ai';

import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';

import { runAgentForAutomation } from './agent-runtime';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  stepCountIs: jest.fn(() => 'stop'),
}));
jest.mock('@/features/ai-runtime/providers/central-runtime', () => ({
  runCentralAi: jest.fn(),
}));
jest.mock('./provider', () => ({
  getAIModel: jest.fn(() => 'default'),
  getAIProvider: jest.fn(() => jest.fn(() => 'model')),
}));
jest.mock('./knowledge-context', () => ({ buildKnowledgeContext: jest.fn(async () => '') }));
jest.mock('./agent-tools', () => ({ createAgentTools: jest.fn(() => ({ dangerous: {} })) }));

const generateMock = jest.mocked(generateText);
const centralMock = jest.mocked(runCentralAi);

describe('runAgentForAutomation', () => {
  it('routes platform agents through central Mkety AI with tools disabled', async () => {
    centralMock.mockResolvedValue({
      text: 'done',
      provider: 'workers-ai',
      nativeModel: '@cf/zai-org/glm-5.3-flash',
      source: 'managed',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    });
    const result = await runAgentForAutomation(
      {
        id: 'a1',
        tenantId: 't1',
        projectId: 'p1',
        name: 'Agent',
        instructions: 'Help',
        provider: 'platform',
        model: null,
        status: 'published',
        config: '{"tools":["dangerous"]}',
      },
      [{ role: 'user', content: 'Hello' }],
      { tools: 'disabled' },
    );

    expect(centralMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 't1',
      projectId: 'p1',
      tools: [],
    }));
    expect(result).toEqual({ text: 'done', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('keeps legacy provider records operational during migration', async () => {
    generateMock.mockResolvedValue({
      text: 'legacy',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as never);

    const result = await runAgentForAutomation(
      {
        id: 'a2',
        tenantId: 't1',
        projectId: 'p1',
        name: 'Legacy',
        instructions: 'Help',
        provider: 'openai',
        model: 'legacy-model',
        status: 'published',
        config: null,
      },
      [{ role: 'user', content: 'Hello' }],
      { tools: 'disabled' },
    );

    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ tools: {} }));
    expect(result.text).toBe('legacy');
  });
});
