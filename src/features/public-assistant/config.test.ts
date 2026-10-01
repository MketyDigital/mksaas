import { getPublicAssistantLaunchState, parsePublicAIProviderConfig } from './config';

describe('Public Mkety AI launch boundary', () => {
  it('is disabled by default and never falls back to tenant AI implicitly', () => {
    expect(getPublicAssistantLaunchState({})).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('accepts all six public provider families through one isolated config contract', () => {
    const providers = ['openai', 'azure-openai', 'gemini', 'vertex', 'cloudflare-ai', 'bedrock'];

    for (const provider of providers) {
      const parsed = parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: provider,
        MKETY_PUBLIC_AI_MODEL:
          provider === 'cloudflare-ai'
            ? '@cf/qwen/qwen3.8-27b'
            : provider === 'bedrock'
              ? 'global.anthropic.claude-sonnet-5'
              : provider === 'gemini' || provider === 'vertex'
                ? 'gemini-3.8-flash'
                : 'gpt-5.6-terra',
      });

      expect(parsed.primaryProvider).toBe(provider);
    }
  });

  it('uses a current September 2026 default model for each provider', () => {
    expect(
      parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'openai',
      }).model,
    ).toBe('gpt-5.6-luna');

    expect(
      parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'gemini',
      }).model,
    ).toBe('gemini-3.8-flash');

    expect(
      parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'cloudflare-ai',
      }).model,
    ).toBe('@cf/qwen/qwen3.8-27b');
  });

  it('parses an ordered fallback chain without exposing tenant provider config', () => {
    expect(
      parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'gemini',
        MKETY_PUBLIC_AI_FALLBACK_PROVIDERS: 'cloudflare-ai,openai',
      }).fallbackProviders,
    ).toEqual(['cloudflare-ai', 'openai']);
  });

  it('rejects a legacy model instead of silently substituting another model', () => {
    expect(() =>
      parsePublicAIProviderConfig({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'openai',
        MKETY_PUBLIC_AI_MODEL: 'gpt-4o-mini',
      }),
    ).toThrow(/not an approved current public AI model/i);
  });
});


describe('Azure Foundry public AI aliases', () => {
  it('accepts the Foundry project endpoint and OPEN_AI MODEL naming', async () => {
    const { resolvePublicAzureOpenAIConfig } = await import('./config');
    expect(resolvePublicAzureOpenAIConfig({
      MKETY_PUBLIC_AZURE_OPEN_AI_API_KEY: 'test-key',
      MKETY_PUBLIC_AZURE_OPEN_AI_ENDPOINT: 'https://hello-3399-resource.services.ai.azure.com/api/projects/hello-3399',
      MKETY_PUBLIC_AZURE_OPEN_AI_MODEL: 'gpt-5.6-sol-1',
    })).toEqual({
      apiKey: 'test-key',
      endpoint: 'https://hello-3399-resource.services.ai.azure.com/api/projects/hello-3399',
      deployment: 'gpt-5.6-sol-1',
    });
  });

  it('keeps the existing Azure OpenAI spelling backward compatible', async () => {
    const { resolvePublicAzureOpenAIConfig } = await import('./config');
    expect(resolvePublicAzureOpenAIConfig({
      MKETY_PUBLIC_AZURE_OPENAI_API_KEY: 'old-key',
      MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
      MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT: 'legacy-deployment',
    })).toEqual({
      apiKey: 'old-key',
      endpoint: 'https://example.openai.azure.com',
      deployment: 'legacy-deployment',
    });
  });
});
