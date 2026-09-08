import { runPublicAIGateway } from './gateway';
import type { PublicAIProviderAdapter } from './providers/types';

describe('Public Mkety AI gateway', () => {
  const request = {
    model: 'gpt-5.6-terra',
    messages: [{ role: 'user' as const, content: 'What is Mkety?' }],
    system: 'Public Mkety support only.',
  };

  it('returns the primary provider response without exposing provider choice to the caller contract', async () => {
    const primary: PublicAIProviderAdapter = {
      id: 'openai',
      generate: async () => ({ text: 'Mkety is a technology platform.', usage: { outputTokens: 8 } }),
    };

    await expect(
      runPublicAIGateway({ request, primary, fallbacks: [] }),
    ).resolves.toMatchObject({ text: 'Mkety is a technology platform.', fallbackCount: 0 });
  });

  it('uses the ordered fallback only for retryable provider failures', async () => {
    const primary: PublicAIProviderAdapter = {
      id: 'openai',
      generate: async () => {
        throw Object.assign(new Error('temporary'), { retryable: true });
      },
    };
    const fallback: PublicAIProviderAdapter = {
      id: 'gemini',
      generate: async () => ({ text: 'Fallback answer.' }),
    };

    await expect(
      runPublicAIGateway({ request, primary, fallbacks: [fallback] }),
    ).resolves.toMatchObject({ text: 'Fallback answer.', fallbackCount: 1 });
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

    await expect(runPublicAIGateway({ request, primary, fallbacks: [fallback] })).rejects.toThrow(
      /bad request/,
    );
    expect(fallbackCalled).toBe(false);
  });
});
