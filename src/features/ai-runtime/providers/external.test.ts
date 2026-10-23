/** @jest-environment node */

import { createCentralExternalProvider } from './external';

describe('Azure OpenAI / Microsoft Foundry endpoint resolution', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('preserves a Foundry project path when adding the Responses API path', async () => {
    const fetchMock = jest.fn().mockResolvedValue(Response.json({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'ready' }] }],
    }));
    globalThis.fetch = fetchMock;

    const provider = createCentralExternalProvider({
      provider: 'azure-openai',
      apiKey: 'test-key',
      endpoint: 'https://mkety-resource.services.ai.azure.com/api/projects/mkety-project',
      deployment: 'gpt-6-luna-1',
    });

    await provider.generate({
      model: 'gpt-6-luna-1',
      system: 'Return a readiness response.',
      messages: [{ role: 'user', content: 'Say ready.' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mkety-resource.services.ai.azure.com/api/projects/mkety-project/openai/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps conventional Azure resource-root endpoints working', async () => {
    const fetchMock = jest.fn().mockResolvedValue(Response.json({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'ready' }] }],
    }));
    globalThis.fetch = fetchMock;

    const provider = createCentralExternalProvider({
      provider: 'azure-openai',
      apiKey: 'test-key',
      endpoint: 'https://mkety-resource.openai.azure.com',
      deployment: 'gpt-5.6-terra',
    });

    await provider.generate({
      model: 'gpt-5.6-terra',
      system: 'Return a readiness response.',
      messages: [{ role: 'user', content: 'Say ready.' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mkety-resource.openai.azure.com/openai/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
