import {
  calculateProviderCostUsdMicros,
  getManagedAiCostRate,
  getManagedAiCostRateForModel,
  minimumCustomerRevenueUsdMicros,
} from './provider-cost';

describe('Enterprise AI provider cost and pricing floor', () => {
  it('calculates exact token-based provider cost in micro-USD', () => {
    const rate = getManagedAiCostRate('@cf/zai-org/glm-5.3-flash');
    expect(rate).not.toBeNull();
    expect(calculateProviderCostUsdMicros({
      rate: rate!,
      inputTokens: 1_000_000n,
      outputTokens: 1_000_000n,
    })).toBe(650_000n);
  });

  it('builds in a 65% gross-margin target plus 15% overhead reserve by default', () => {
    const floor = minimumCustomerRevenueUsdMicros(1_000_000n);
    expect(floor).toBeGreaterThanOrEqual(3_285_714n);
  });

  it('keeps model costs server-owned and explicitly verification dated', () => {
    expect(getManagedAiCostRate('@cf/google/gemma-4-26b-a4b-it')?.verifiedAt).toBe('2026-09-28');
    expect(getManagedAiCostRate('@cf/qwen/qwen3.8-27b')?.outputUsdMicrosPerMillion).toBe(3_200_000n);
  });

  it('requires verified metadata before an external managed model has a commercial cost rate', () => {
    expect(getManagedAiCostRateForModel({
      nativeModel: 'gpt-5.6-sol',
      providerCostMetadata: {},
    })).toBeNull();

    expect(getManagedAiCostRateForModel({
      nativeModel: 'gpt-5.6-sol',
      providerCostMetadata: {
        inputUsdMicrosPerMillion: '2500000',
        cachedInputUsdMicrosPerMillion: '250000',
        outputUsdMicrosPerMillion: '10000000',
        providerCostVerifiedAt: '2026-09-30',
      },
    })).toEqual({
      model: 'gpt-5.6-sol',
      verifiedAt: '2026-09-30',
      inputUsdMicrosPerMillion: 2_500_000n,
      cachedInputUsdMicrosPerMillion: 250_000n,
      outputUsdMicrosPerMillion: 10_000_000n,
    });
  });
});
