import {
  calculateAiCredits,
  estimateAiReservationCredits,
} from './commercial-rates';

const rate = {
  inputCreditsPerMillion: 100n,
  cachedInputCreditsPerMillion: 25n,
  outputCreditsPerMillion: 400n,
  minimumCreditsPerRequest: 2n,
};

describe('AI commercial rate accounting', () => {
  it('charges uncached, cached, and output usage independently with integer ceiling', () => {
    expect(calculateAiCredits({
      inputTokens: 1_500_000n,
      cachedInputTokens: 500_000n,
      outputTokens: 250_000n,
      rate,
    })).toBe(213n);
  });

  it('enforces a minimum request charge', () => {
    expect(calculateAiCredits({
      inputTokens: 1n,
      outputTokens: 1n,
      rate,
    })).toBe(2n);
  });

  it('reserves against uncached worst-case input and max output', () => {
    expect(estimateAiReservationCredits({
      inputTokenUpperBound: 1_000_000n,
      maxOutputTokens: 500_000n,
      rate,
    })).toBe(300n);
  });

  it('rejects impossible cached-token accounting', () => {
    expect(() => calculateAiCredits({
      inputTokens: 10n,
      cachedInputTokens: 11n,
      outputTokens: 1n,
      rate,
    })).toThrow('Invalid AI usage token counts.');
  });
});
