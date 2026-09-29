import { getManagedAiModelCandidate, MANAGED_AI_MODEL_CANDIDATES } from './model-candidates';

describe('managed AI model candidates', () => {
  it('records Gemma 4 as the managed primary model', () => {
    expect(getManagedAiModelCandidate('gemma-4')).toMatchObject({ stage: 'managed-primary', nativeModel: '@cf/google/gemma-4-26b-a4b-it' });
  });

  it('records GLM as managed smart and Qwen as benchmarked reserve', () => {
    expect(getManagedAiModelCandidate('glm-5.3-flash')?.stage).toBe('managed-smart');
    expect(getManagedAiModelCandidate('qwen-3.8-27b')?.stage).toBe('benchmarked-reserve');
  });

  it('records the currently verified GLM price advantage over Qwen', () => {
    const glm = getManagedAiModelCandidate('glm-5.3-flash')!;
    const qwen = getManagedAiModelCandidate('qwen-3.8-27b')!;
    expect(glm.pricingUsdPerMillionTokens.input).toBeLessThan(qwen.pricingUsdPerMillionTokens.input);
    expect(glm.pricingUsdPerMillionTokens.output).toBeLessThan(qwen.pricingUsdPerMillionTokens.output);
  });

  it('requires the launch capability set for every candidate', () => {
    for (const model of MANAGED_AI_MODEL_CANDIDATES) {
      expect(model.capabilities).toMatchObject({ text: true, vision: true, tools: true, reasoning: true, structuredOutput: true });
    }
  });
});
