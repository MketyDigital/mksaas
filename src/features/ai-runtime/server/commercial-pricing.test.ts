import {
  calculateEnterpriseAiIncludedCredits,
  providerCostToCreditsPerMillion,
} from './commercial-pricing';

describe('Enterprise AI commercial pricing', () => {
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
});
