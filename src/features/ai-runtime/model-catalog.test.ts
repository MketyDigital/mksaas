import { INITIAL_MANAGED_MODEL_CANDIDATES, getManagedModelCandidate } from './model-catalog';

describe('Mkety managed AI model candidates', () => {
  it('keeps Gemma 4 as the day-one managed candidate', () => {
    const gemma = getManagedModelCandidate('mkety-gemma');
    expect(gemma?.nativeModel).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(gemma?.stage).toBe('day-one');
  });

  it('benchmarks GLM-5.3 Flash and Qwen 3.8 instead of prematurely locking either', () => {
    expect(getManagedModelCandidate('mkety-glm-flash')?.stage).toBe('benchmark');
    expect(getManagedModelCandidate('mkety-qwen')?.stage).toBe('benchmark');
  });

  it('records the currently verified GLM cost advantage over Qwen', () => {
    const glm = getManagedModelCandidate('mkety-glm-flash');
    const qwen = getManagedModelCandidate('mkety-qwen');
    expect(glm).not.toBeNull();
    expect(qwen).not.toBeNull();
    expect(glm!.providerCostReference.inputPerMillionUsd)
      .toBeLessThan(qwen!.providerCostReference.inputPerMillionUsd);
    expect(glm!.providerCostReference.outputPerMillionUsd)
      .toBeLessThan(qwen!.providerCostReference.outputPerMillionUsd);
  });

  it('has unique public aliases and native provider model ids', () => {
    expect(new Set(INITIAL_MANAGED_MODEL_CANDIDATES.map((model) => model.alias)).size)
      .toBe(INITIAL_MANAGED_MODEL_CANDIDATES.length);
    expect(new Set(INITIAL_MANAGED_MODEL_CANDIDATES.map((model) => model.nativeModel)).size)
      .toBe(INITIAL_MANAGED_MODEL_CANDIDATES.length);
  });
});
