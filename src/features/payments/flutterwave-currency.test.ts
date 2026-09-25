import {
  getEnabledFlutterwaveSettlementCurrencies,
  getFlutterwaveSettlementRateMap,
  quoteFlutterwaveSettlement,
} from './flutterwave-currency';

describe('Flutterwave settlement currency quoting', () => {
  it('keeps USD canonical and always enabled', () => {
    expect(getFlutterwaveSettlementRateMap()).toEqual({ USD: '1' });
    expect(getEnabledFlutterwaveSettlementCurrencies()).toEqual(['USD']);
  });

  it('quotes configured local currency from canonical USD minor units', () => {
    const quote = quoteFlutterwaveSettlement({
      canonicalUsdMinor: 599n,
      currency: 'NGN',
      serializedRates: JSON.stringify({ NGN: '1580', GHS: '15.4' }),
    });

    expect(quote).toEqual({
      canonicalAmountMinor: 599n,
      canonicalCurrency: 'USD',
      settlementAmountMinor: 946420n,
      settlementCurrency: 'NGN',
      rate: '1580',
    });
  });

  it('rounds to the nearest local minor unit', () => {
    expect(
      quoteFlutterwaveSettlement({
        canonicalUsdMinor: 599n,
        currency: 'GHS',
        serializedRates: JSON.stringify({ GHS: '15.4321' }),
      }).settlementAmountMinor,
    ).toBe(92436n);
  });

  it('does not offer a local currency without a server-owned rate', () => {
    expect(() =>
      quoteFlutterwaveSettlement({
        canonicalUsdMinor: 599n,
        currency: 'KES',
        serializedRates: JSON.stringify({ NGN: '1580' }),
      }),
    ).toThrow('not enabled');
  });
});
