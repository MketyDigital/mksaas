import {
  DEFAULT_MKETY_PAYMENT_SETTINGS,
  normalizeMketyPaymentSettings,
} from './config';

describe('Mkety payment settings', () => {
  it('keeps the payment defaults safe and provider-neutral', () => {
    expect(DEFAULT_MKETY_PAYMENT_SETTINGS).toEqual({
      baseCurrency: 'USD',
      nowpayments: { checkoutExperience: 'hosted' },
      flutterwave: {
        checkoutExperience: 'inline',
        fxRates: {},
        fxMarkupBps: 0,
      },
      kora: { checkoutExperience: 'embedded' },
    });
  });

  it('normalizes approved Flutterwave FX rates and markup', () => {
    expect(
      normalizeMketyPaymentSettings({
        flutterwave: {
          fxRates: {
            NGN: '1600',
            GHS: 15.5,
            GBP: '0.78',
          },
          fxMarkupBps: 175,
        },
      }),
    ).toMatchObject({
      baseCurrency: 'USD',
      flutterwave: {
        fxRates: {
          NGN: '1600',
          GHS: '15.5',
          GBP: '0.78',
        },
        fxMarkupBps: 175,
      },
    });
  });

  it('drops invalid or unsupported rates instead of making them customer-visible', () => {
    expect(
      normalizeMketyPaymentSettings({
        flutterwave: {
          fxRates: {
            NGN: '-1',
            GHS: 'abc',
            USD: '2',
            BAD: '100',
            KES: '130.123456789',
          },
          fxMarkupBps: 9000,
        },
      }).flutterwave,
    ).toEqual({
      checkoutExperience: 'inline',
      fxRates: {},
      fxMarkupBps: 0,
    });
  });
});
