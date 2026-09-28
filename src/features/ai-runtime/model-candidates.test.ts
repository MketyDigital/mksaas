import { getManagedAiModelCandidate, MANAGED_AI_MODEL_CANDIDATES } from './model-candidates';

describe('managed AI model candidates', () => {
  it('keeps Gemma 4 as the approved initial candidate', () => {
    expect(getManagedAiModelCandidate('gemma-4')).toMatchObject({
      nativeModel: '@cf/google/gemma-4-26b-a4b-it',
      status: 'approved-candidate',
      contextTokens: 256_000,
    });
  });

  it('benchmarks GLM-5.3 Flash and Qwen 3.8 instead of hard-wiring either', () => {
    expect(getManagedAiModelCandidate('glm-5.3-flash')?.status).toBe('benchmark-candidate');
    expect(getManagedAiModelCandidate('qwen-3.8-27b')?.status).toBe('benchmark-candidate');
  });

  it('requires tool, reasoning, vision and structured-output capability for the initial set', () => {
    for (const model of MANAGED_AI_MODEL_CANDIDATES) {
      expect(model.capabilities).toMatchObject({
        text: true,
        vision: true,
        tools: true,
        reasoning: true,
        structuredOutput: true,
      });
    }
  });
});
