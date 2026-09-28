import { getManagedAiModelCandidate, MANAGED_AI_MODEL_CANDIDATES } from './model-candidates';

describe('managed AI model candidates', () => {
  it('keeps Gemma 4 as the day-one candidate', () => {
    expect(getManagedAiModelCandidate('gemma-4')).toMatchObject({ stage: 'day-one', nativeModel: '@cf/google/gemma-4-26b-a4b-it' });
  });

  it('keeps GLM and Qwen behind the benchmark gate', () => {
    expect(getManagedAiModelCandidate('glm-5.3-flash')?.stage).toBe('benchmark');
    expect(getManagedAiModelCandidate('qwen-3.8-27b')?.stage).toBe('benchmark');
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
