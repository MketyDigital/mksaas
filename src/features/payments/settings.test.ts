/** @jest-environment node */

jest.mock('@/shared/db', () => ({ db: {} }));

import { quoteMketyFlutterwaveCurrency, type MketyPaymentSettings } from './settings';

const settings: MketyPaymentSettings = {
  baseCurrency: 'USD',
  enabledCurrencies: ['USD', 'NGN', 'GBP'],
  fxRates: { NGN: '1500', GBP: '0.78125' },
  fxMarkupBps: 200,
};

describe('Mkety payment FX settings', () => {
  it('keeps USD identical and ignores markup for the base currency', () => {
    expect(
      quoteMketyFlutterwaveCurrency({
        canonicalAmountMinor: 3999n,
        collectionCurrency: 'USD',
        settings,
      }),
    ).toEqual({
      amountMinor: 3999n,
      currency: 'USD',
      baseRate: '1',
      markupBps: 0,
      source: 'identity',
    });
  });

  it('applies the admin rate and markup while rounding upward', () => {
    const quote = quoteMketyFlutterwaveCurrency({
      canonicalAmountMinor: 3999n,
      collectionCurrency: 'NGN',
      settings,
    });

    expect(quote).toEqual({
      amountMinor: 6118470n,
      currency: 'NGN',
      baseRate: '1500',
      markupBps: 200,
      source: 'platform-admin',
    });
  });

  it('fails closed when an enabled non-USD currency has no configured rate', () => {
    expect(() =>
      quoteMketyFlutterwaveCurrency({
        canonicalAmountMinor: 3999n,
        collectionCurrency: 'GBP',
        settings: { ...settings, fxRates: { NGN: '1500' } },
      }),
    ).toThrow('not configured');
  });

  it('rejects a currency disabled in Platform Control', () => {
    expect(() =>
      quoteMketyFlutterwaveCurrency({
        canonicalAmountMinor: 3999n,
        collectionCurrency: 'KES',
        settings,
      }),
    ).toThrow('not enabled');
  });
});
