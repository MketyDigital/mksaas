import type { Database } from '@/shared/db';

import { calculateSelfServiceTermQuote, getActiveSelfServicePlans } from './active-catalog';

describe('active self-service billing catalog', () => {
  it('runs every public Mail plan read through the supplied request database', async () => {
    const select = jest.fn(() => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }) }),
    }));
    const database = { select } as unknown as Database;

    const plans = await getActiveSelfServicePlans(['mail-starter', 'mail-growth', 'mail-business'], database);

    expect(select).toHaveBeenCalledTimes(3);
    expect(plans.map((plan) => plan.key)).toEqual(['mail-starter', 'mail-growth', 'mail-business']);
  });
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
