import { calculateSelfServiceTermQuote } from './active-catalog';

describe('active self-service billing catalog', () => {
  it('applies the standard prepaid discount ladder to the active monthly amount', () => {
    expect(calculateSelfServiceTermQuote(1000n, '1m').amountMinor).toBe(1000n);
    expect(calculateSelfServiceTermQuote(1000n, '3m').amountMinor).toBe(2850n);
    expect(calculateSelfServiceTermQuote(1000n, '6m').amountMinor).toBe(5400n);
    expect(calculateSelfServiceTermQuote(1000n, '12m').amountMinor).toBe(10200n);
  });

  it('keeps savings and effective monthly price derived from the same active version', () => {
    const quote = calculateSelfServiceTermQuote(499n, '12m');
    expect(quote.undiscountedMinor).toBe(5988n);
    expect(quote.amountMinor).toBe(5090n);
    expect(quote.savingsMinor).toBe(898n);
    expect(quote.effectiveMonthlyMinor).toBe(424n);
  });
});
