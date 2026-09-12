import { assertCurrentPublicAIModel, getPublicAIModelDefinition, PUBLIC_AI_MODEL_REGISTRY } from './models';

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
    expect(getPublicAIModelDefinition('cloudflare-ai', '@cf/qwen/qwen3.8-27b')?.status).toBe('current-stable');
    expect(getPublicAIModelDefinition('bedrock', 'global.anthropic.claude-sonnet-5')?.status).toBe('current-stable');
    expect(getPublicAIModelDefinition('azure-openai', 'gpt-5.6-terra')?.status).toBe('current-stable');
  });

  it('defaults OpenAI public support to an approved model accessible to the staging project', () => {
    expect(PUBLIC_AI_MODEL_REGISTRY.openai.defaultModel).toBe('gpt-5.6-luna');
    expect(getPublicAIModelDefinition('openai', PUBLIC_AI_MODEL_REGISTRY.openai.defaultModel)?.status).toBe(
      'current-stable',
    );
  });

  it('keeps current limited-access models visible without using them as blind defaults', () => {
    expect(getPublicAIModelDefinition('openai', 'gpt-6-astra')?.status).toBe('current-limited');
    expect(getPublicAIModelDefinition('azure-openai', 'gpt-6-astra')?.status).toBe('current-limited');
  });

  it.each([
    ['openai', 'gpt-4o-mini'],
    ['gemini', 'gemini-2.0-flash'],
    ['vertex', 'gemini-2.0-flash'],
  ] as const)('rejects legacy/unapproved public model %s:%s', (provider, model) => {
    expect(() => assertCurrentPublicAIModel(provider, model)).toThrow(/not an approved current/);
  });
});
