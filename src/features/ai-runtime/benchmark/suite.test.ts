import {
  calculateRawProviderCostUsd,
  ENTERPRISE_AI_BENCHMARK_SUITE,
  validateBenchmarkCandidate,
} from './suite';
import { getManagedAiModelCandidate } from '../model-candidates';

describe('Enterprise AI benchmark suite', () => {
  it('covers every approved comparison dimension', () => {
    expect(new Set(ENTERPRISE_AI_BENCHMARK_SUITE.map((testCase) => testCase.category))).toEqual(new Set([
      'chat',
      'long_context_rag',
      'tool_calls',
      'structured_output',
      'coding',
      'reasoning',
      'vision',
      'latency',
      'reliability',
      'cost',
    ]));
  });

  it('accepts all three current multimodal benchmark candidates for required capability cases', () => {
    for (const key of ['gemma-4', 'glm-5.3-flash', 'qwen-3.8-27b'] as const) {
      const model = getManagedAiModelCandidate(key)!;
      for (const testCase of ENTERPRISE_AI_BENCHMARK_SUITE) {
        expect(validateBenchmarkCandidate(model, testCase)).toBe(true);
      }
    }
  });

  it('normalizes raw provider cost from observed token usage', () => {
    const glm = getManagedAiModelCandidate('glm-5.3-flash')!;
    expect(calculateRawProviderCostUsd({
      model: glm,
      inputTokens: 1_000_000,
      cachedInputTokens: 200_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(0.626, 6);
  });

  it('shows the catalog-cost advantage without deciding the quality winner', () => {
    const glm = getManagedAiModelCandidate('glm-5.3-flash')!;
    const qwen = getManagedAiModelCandidate('qwen-3.8-27b')!;
    const workload = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

    expect(calculateRawProviderCostUsd({ model: glm, ...workload }))
      .toBeLessThan(calculateRawProviderCostUsd({ model: qwen, ...workload }));
  });
});
