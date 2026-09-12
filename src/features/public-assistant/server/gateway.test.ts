import { runPublicAIGateway } from './gateway';
import type { PublicAIProviderAdapter } from './providers/types';

describe('Public Mkety AI gateway', () => {
  const request = {
    messages: [{ role: 'user' as const, content: 'What is Mkety?' }],
    system: 'Public Mkety support only.',
  };

  it('returns the primary provider response without exposing provider choice to the caller contract', async () => {
    const primary: PublicAIProviderAdapter = {
      id: 'openai',
      generate: async () => ({ text: 'Mkety is a technology platform.', usage: { outputTokens: 8 } }),
    };

    await expect(
      runPublicAIGateway({
        request,
        primary: { adapter: primary, model: 'gpt-5.6-terra' },
        fallbacks: [],
      }),
    ).resolves.toMatchObject({ text: 'Mkety is a technology platform.', fallbackCount: 0 });
  });

  it('uses the ordered fallback with that provider own current model', async () => {
    let fallbackModel = '';
    const primary: PublicAIProviderAdapter = {
      id: 'openai',
      generate: async () => {
        throw Object.assign(new Error('temporary'), { retryable: true });
      },
    };
    const fallback: PublicAIProviderAdapter = {
      id: 'gemini',
      generate: async (providerRequest) => {
        fallbackModel = providerRequest.model;
        return { text: 'Fallback answer.' };
      },
    };

    await expect(
      runPublicAIGateway({
        request,
        primary: { adapter: primary, model: 'gpt-5.6-terra' },
        fallbacks: [{ adapter: fallback, model: 'gemini-3.8-flash' }],
      }),
    ).resolves.toMatchObject({ text: 'Fallback answer.', fallbackCount: 1 });
    expect(fallbackModel).toBe('gemini-3.8-flash');
  });

  it('does not fail over a non-retryable validation/provider error', async () => {
    let fallbackCalled = false;
    const primary: PublicAIProviderAdapter = {
      id: 'openai',
      generate: async () => {
        throw Object.assign(new Error('bad request'), { retryable: false });
      },
    };
    const fallback: PublicAIProviderAdapter = {
      id: 'gemini',
      generate: async () => {
        fallbackCalled = true;
        return { text: 'should not happen' };
      },
    };

    await expect(
      runPublicAIGateway({
        request,
        primary: { adapter: primary, model: 'gpt-5.6-terra' },
        fallbacks: [{ adapter: fallback, model: 'gemini-3.8-flash' }],
      }),
    ).rejects.toThrow(/bad request/);
    expect(fallbackCalled).toBe(false);
  });
});
