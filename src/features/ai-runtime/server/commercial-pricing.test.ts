import {
  calculateEnterpriseAiIncludedCredits,
  deriveProviderRateCardCredits,
  providerCostToCreditsPerMillion,
} from './commercial-pricing';

describe('Enterprise AI commercial pricing', () => {
  it('uses a 100% rate multiplier by default', () => {
    const result = calculateEnterpriseAiIncludedCredits({
      monthlyAmountMinor: 10000n,
      managedCostShareBps: 4000,
      operationsReserveBps: 500,
      creditUsdMicros: 1000n,
    });
    expect(result.providerEnvelopeUsdMicros).toBe(40_000_000n);
    expect(result.usableProviderUsdMicros).toBe(38_000_000n);
    expect(result.customerUsageValueUsdMicros).toBe(38_000_000n);
    expect(result.includedCredits).toBe(38_000n);
  });

  it('calculates an internal allowance without exposing provider economics to customers', () => {
    const result = calculateEnterpriseAiIncludedCredits({
      monthlyAmountMinor: 7000n,
      managedCostShareBps: 1500,
      operationsReserveBps: 1000,
      rateMultiplierBps: 20000,
      creditUsdMicros: 1000n,
    });
    expect(result.providerEnvelopeUsdMicros).toBe(10_500_000n);
    expect(result.usableProviderUsdMicros).toBe(9_450_000n);
    expect(result.customerUsageValueUsdMicros).toBe(18_900_000n);
    expect(result.includedCredits).toBe(18_900n);
  });

  it('calculates the reported $80 / 25% / 3% Enterprise contract correctly', () => {
    const result = calculateEnterpriseAiIncludedCredits({
      monthlyAmountMinor: 8000n,
      managedCostShareBps: 2500,
      operationsReserveBps: 300,
      rateMultiplierBps: 20000,
      creditUsdMicros: 1000n,
    });
    expect(result.providerEnvelopeUsdMicros).toBe(20_000_000n);
    expect(result.usableProviderUsdMicros).toBe(19_400_000n);
    expect(result.customerUsageValueUsdMicros).toBe(38_800_000n);
    expect(result.includedCredits).toBe(38_800n);
  });

  it('derives Mkety model rates from verified provider costs plus internal multiplier', () => {
    expect(providerCostToCreditsPerMillion({
      providerUsdMicrosPerMillion: 150_000n,
      rateMultiplierBps: 20000,
      creditUsdMicros: 1000n,
    })).toBe(300n);
    expect(providerCostToCreditsPerMillion({
      providerUsdMicrosPerMillion: 500_000n,
      rateMultiplierBps: 20000,
      creditUsdMicros: 1000n,
    })).toBe(1000n);
  });

  it('derives a complete draft rate card including cached-input pricing', () => {
    expect(deriveProviderRateCardCredits({
      inputUsdMicrosPerMillion: 150_000n,
      cachedInputUsdMicrosPerMillion: 30_000n,
      outputUsdMicrosPerMillion: 600_000n,
      rateMultiplierBps: 20000,
      creditUsdMicros: 1000n,
    })).toEqual({
      inputCreditsPerMillion: 300n,
      cachedInputCreditsPerMillion: 60n,
      outputCreditsPerMillion: 1200n,
    });
  });

  it('rounds provider-derived rates upward so Mkety never under-recovers fractional credits', () => {
    expect(providerCostToCreditsPerMillion({
      providerUsdMicrosPerMillion: 1n,
      rateMultiplierBps: 10000,
      creditUsdMicros: 1000n,
    })).toBe(1n);
  });
});
