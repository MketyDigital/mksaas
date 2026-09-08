import { parseEnterpriseCheckoutInput, parseUsdAmountToMinorUnits } from './domain';

describe('enterprise checkout domain', () => {
  it('converts USD decimal strings to integer minor units', () => {
    expect(parseUsdAmountToMinorUnits('199')).toBe(19900n);
    expect(parseUsdAmountToMinorUnits('199.99')).toBe(19999n);
    expect(parseUsdAmountToMinorUnits('10.00')).toBe(1000n);
  });

  it('rejects amounts outside launch bounds', () => {
    expect(() => parseUsdAmountToMinorUnits('9.99')).toThrow();
    expect(() => parseUsdAmountToMinorUnits('1000000.01')).toThrow();
    expect(() => parseUsdAmountToMinorUnits('1e3')).toThrow();
  });

  it('accepts a valid enterprise checkout request', () => {
    const parsed = parseEnterpriseCheckoutInput({
      fullName: 'Ada Lovelace',
      companyName: 'Analytical Engines Ltd',
      email: 'ada@example.com',
      projectName: 'Enterprise AI rollout',
      projectDescription: 'Public-facing support and internal workflow project.',
      amount: '199.99',
      currency: 'USD',
      provider: 'nowpayments',
    });

    expect(parsed.amountMinor).toBe(19999n);
    expect(parsed.currency).toBe('USD');
    expect(parsed.provider).toBe('nowpayments');
  });

  it('rejects unsupported provider, currency, and malformed identity fields', () => {
    expect(() => parseEnterpriseCheckoutInput({
      fullName: 'A',
      companyName: 'Company',
      email: 'not-an-email',
      projectName: 'Project',
      amount: '199',
      currency: 'EUR',
      provider: 'stripe',
    })).toThrow();
  });
});
