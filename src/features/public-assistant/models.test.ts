import {
  PUBLIC_AI_MODEL_REGISTRY,
  assertCurrentPublicAIModel,
  getPublicAIModelDefinition,
} from './models';

describe('Public Mkety AI September 2026 model registry', () => {
  it('registers every supported public provider with a current production model', () => {
    expect(Object.keys(PUBLIC_AI_MODEL_REGISTRY).sort()).toEqual([
      'azure-openai',
      'bedrock',
      'cloudflare-ai',
      'gemini',
      'openai',
      'vertex',
    ]);

    expect(getPublicAIModelDefinition('openai', 'gpt-5.6-terra')?.status).toBe('current-stable');
    expect(getPublicAIModelDefinition('gemini', 'gemini-3.8-flash')?.status).toBe('current-stable');
    expect(getPublicAIModelDefinition('vertex', 'gemini-3.8-flash')?.status).toBe('current-stable');
    expect(getPublicAIModelDefinition('cloudflare-ai', '@cf/qwen/qwen3.8-27b')?.status).toBe(
      'current-stable',
    );
    expect(getPublicAIModelDefinition('bedrock', 'global.anthropic.claude-sonnet-5')?.status).toBe(
      'current-stable',
    );
    expect(getPublicAIModelDefinition('azure-openai', 'gpt-5.6-terra')?.status).toBe(
      'current-stable',
    );
  });

  it('tracks current limited rollout models without treating them as production defaults', () => {
    expect(getPublicAIModelDefinition('openai', 'gpt-6-astra')?.status).toBe('current-limited');
    expect(getPublicAIModelDefinition('azure-openai', 'gpt-6-astra')?.status).toBe('current-limited');
  });

  it.each([
    ['openai', 'gpt-4o-mini'],
    ['gemini', 'gemini-2.0-flash'],
    ['vertex', 'gemini-2.0-flash'],
  ] as const)('rejects legacy or unapproved model %s/%s', (provider, model) => {
    expect(() => assertCurrentPublicAIModel(provider, model)).toThrow(/not an approved current public AI model/i);
  });

  it('accepts current limited models when explicitly configured', () => {
    expect(assertCurrentPublicAIModel('openai', 'gpt-6-astra').id).toBe('gpt-6-astra');
  });
});
