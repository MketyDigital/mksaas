export const FLUTTERWAVE_SETTLEMENT_CURRENCIES = ['USD', 'NGN', 'GHS', 'KES', 'GBP', 'EUR'] as const;

export type FlutterwaveSettlementCurrency = (typeof FLUTTERWAVE_SETTLEMENT_CURRENCIES)[number];

const CURRENCY_LABELS: Record<FlutterwaveSettlementCurrency, string> = {
  USD: 'US Dollar',
  NGN: 'Nigerian Naira',
  GHS: 'Ghanaian Cedi',
  KES: 'Kenyan Shilling',
  GBP: 'British Pound',
  EUR: 'Euro',
};

const CURRENCY_SYMBOLS: Record<FlutterwaveSettlementCurrency, string> = {
  USD: '$',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh ',
  GBP: '£',
  EUR: '€',
};

export interface FlutterwaveSettlementQuote {
  canonicalAmountMinor: bigint;
  canonicalCurrency: 'USD';
  settlementAmountMinor: bigint;
  settlementCurrency: FlutterwaveSettlementCurrency;
  rate: string;
}

export function isFlutterwaveSettlementCurrency(value: string): value is FlutterwaveSettlementCurrency {
  return (FLUTTERWAVE_SETTLEMENT_CURRENCIES as readonly string[]).includes(value);
}

function parsePositiveDecimal(value: string): { numerator: bigint; denominator: bigint } {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(normalized);
  if (!match) throw new Error('Flutterwave settlement rate must be a positive decimal.');
  const fraction = match[2] ?? '';
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(match[1]) * denominator + BigInt(fraction || '0');
  if (numerator <= 0n) throw new Error('Flutterwave settlement rate must be greater than zero.');
  return { numerator, denominator };
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function getFlutterwaveSettlementRateMap(
  serialized: string | undefined = process.env.MKETY_FLUTTERWAVE_USD_RATES_JSON,
): Partial<Record<FlutterwaveSettlementCurrency, string>> {
  const rates: Partial<Record<FlutterwaveSettlementCurrency, string>> = { USD: '1' };
  if (!serialized?.trim()) return rates;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('MKETY_FLUTTERWAVE_USD_RATES_JSON must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MKETY_FLUTTERWAVE_USD_RATES_JSON must be a JSON object.');
  }

  for (const [rawCurrency, rawRate] of Object.entries(parsed as Record<string, unknown>)) {
    const currency = rawCurrency.toUpperCase();
    if (!isFlutterwaveSettlementCurrency(currency) || currency === 'USD') continue;
    if (typeof rawRate !== 'string' && typeof rawRate !== 'number') continue;
    const value = String(rawRate);
    parsePositiveDecimal(value);
    rates[currency] = value;
  }

  return rates;
}

export function getEnabledFlutterwaveSettlementCurrencies(
  serialized: string | undefined = process.env.MKETY_FLUTTERWAVE_USD_RATES_JSON,
): FlutterwaveSettlementCurrency[] {
  const rates = getFlutterwaveSettlementRateMap(serialized);
  return FLUTTERWAVE_SETTLEMENT_CURRENCIES.filter((currency) => Boolean(rates[currency]));
}

export function quoteFlutterwaveSettlement(input: {
  canonicalUsdMinor: bigint;
  currency: FlutterwaveSettlementCurrency;
  serializedRates?: string;
}): FlutterwaveSettlementQuote {
  if (input.canonicalUsdMinor <= 0n) throw new Error('Canonical Mkety amount must be greater than zero.');
  const rates = getFlutterwaveSettlementRateMap(input.serializedRates);
  const rate = rates[input.currency];
  if (!rate) throw new Error(`${input.currency} settlement is not enabled for Flutterwave.`);

  const { numerator, denominator } = parsePositiveDecimal(rate);
  const settlementAmountMinor = roundDivide(input.canonicalUsdMinor * numerator, denominator);
  if (settlementAmountMinor <= 0n) throw new Error('Flutterwave settlement amount is invalid.');

  return {
    canonicalAmountMinor: input.canonicalUsdMinor,
    canonicalCurrency: 'USD',
    settlementAmountMinor,
    settlementCurrency: input.currency,
    rate,
  };
}

export function formatFlutterwaveSettlementAmount(amountMinor: bigint, currency: FlutterwaveSettlementCurrency): string {
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, '0');
  return `${CURRENCY_SYMBOLS[currency]}${major.toLocaleString()}.${minor}`;
}

export function getFlutterwaveCurrencyLabel(currency: FlutterwaveSettlementCurrency): string {
  return CURRENCY_LABELS[currency];
}
