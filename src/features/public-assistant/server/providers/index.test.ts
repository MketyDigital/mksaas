import { createPublicAIProviderAdapters } from './index';
import { createOpenAIPublicAdapter } from './openai';

describe('Public Mkety AI provider adapter factory', () => {
  it('builds only configured public-specific providers in requested order', () => {
    const adapters = createPublicAIProviderAdapters(
      ['gemini', 'openai', 'cloudflare-ai'],
      {
        MKETY_PUBLIC_GEMINI_API_KEY: 'gemini-key',
        MKETY_PUBLIC_OPENAI_API_KEY: 'openai-key',
        MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID: 'account',
        MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN: 'cf-token',
      },
    );

    expect(adapters.map((adapter) => adapter.id)).toEqual(['gemini', 'openai', 'cloudflare-ai']);
  });

  it('does not use the tenant OPENAI_API_KEY as a public runtime credential', () => {
    const adapters = createPublicAIProviderAdapters(['openai'], { OPENAI_API_KEY: 'tenant-key' });
    expect(adapters).toEqual([]);
  });

  it('uses no reasoning effort for low-latency public support responses', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ output_text: 'Mkety support answer.' }),
    }) as unknown as Response);
    global.fetch = fetchMock as typeof fetch;

    try {
      const adapter = createOpenAIPublicAdapter('public-key');
      await adapter.generate({
        model: 'gpt-5.6-luna',
        messages: [{ role: 'user', content: 'What is Mkety?' }],
        system: 'Public Mkety support only.',
        maxOutputTokens: 900,
      });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const body = JSON.parse(String(init?.body ?? '{}')) as { reasoning?: { effort?: string } };
      expect(body.reasoning).toEqual({ effort: 'none' });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
