import { createPublicAIProviderAdapters } from './index';

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
});
