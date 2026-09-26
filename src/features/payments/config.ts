export const MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES = [
  'USD',
  'NGN',
  'GHS',
  'KES',
  'GBP',
  'EUR',
  'ZAR',
  'XAF',
  'XOF',
  'UGX',
  'RWF',
  'TZS',
  'MWK',
  'EGP',
] as const;

export type MketyFlutterwaveCollectionCurrency =
  (typeof MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES)[number];

export type MketyFlutterwaveFxRates = Partial<
  Record<MketyFlutterwaveCollectionCurrency, string>
>;

export interface MketyPaymentSettings {
  baseCurrency: 'USD';
  nowpayments: {
    checkoutExperience: 'hosted';
  };
  flutterwave: {
    checkoutExperience: 'inline';
    fxRates: MketyFlutterwaveFxRates;
    fxMarkupBps: number;
  };
  kora: {
    checkoutExperience: 'embedded';
  };
}

export const DEFAULT_MKETY_PAYMENT_SETTINGS: MketyPaymentSettings = {
  baseCurrency: 'USD',
  nowpayments: {
    checkoutExperience: 'hosted',
  },
  flutterwave: {
    checkoutExperience: 'inline',
    fxRates: {},
    fxMarkupBps: 0,
  },
  kora: {
    checkoutExperience: 'embedded',
  },
};

function normalizeRate(value: unknown): string | undefined {
  const normalized =
    typeof value === 'number'
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) return undefined;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? normalized : undefined;
}

export function normalizeMketyPaymentSettings(value: unknown): MketyPaymentSettings {
  const root = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const flutterwave =
    root.flutterwave && typeof root.flutterwave === 'object' && !Array.isArray(root.flutterwave)
      ? (root.flutterwave as Record<string, unknown>)
      : {};
  const rawRates =
    flutterwave.fxRates && typeof flutterwave.fxRates === 'object' && !Array.isArray(flutterwave.fxRates)
      ? (flutterwave.fxRates as Record<string, unknown>)
      : {};

  const fxRates: MketyFlutterwaveFxRates = {};
  for (const currency of MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES) {
    if (currency === 'USD') continue;
    const rate = normalizeRate(rawRates[currency]);
    if (rate) fxRates[currency] = rate;
  }

  const markup = Number(flutterwave.fxMarkupBps ?? 0);
  const fxMarkupBps = Number.isInteger(markup) && markup >= 0 && markup <= 5000 ? markup : 0;

  return {
    baseCurrency: 'USD',
    nowpayments: { checkoutExperience: 'hosted' },
    flutterwave: {
      checkoutExperience: 'inline',
      fxRates,
      fxMarkupBps,
    },
    kora: { checkoutExperience: 'embedded' },
  };
}
