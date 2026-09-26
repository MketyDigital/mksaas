import { eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES,
  platformPaymentSettings,
  type PlatformPaymentSettings,
} from '@/shared/db/schema';

export type MketyFlutterwaveCurrency = (typeof DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES)[number];

const CURRENCY_SET = new Set<string>(DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES);

export interface MketyPaymentSettings {
  baseCurrency: 'USD';
  enabledCurrencies: MketyFlutterwaveCurrency[];
  fxRates: Partial<Record<MketyFlutterwaveCurrency, string>>;
  fxMarkupBps: number;
}

const DEFAULT_SETTINGS: MketyPaymentSettings = {
  baseCurrency: 'USD',
  enabledCurrencies: [...DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES],
  fxRates: {},
  fxMarkupBps: 0,
};

function normalizeSettings(row?: PlatformPaymentSettings | null): MketyPaymentSettings {
  if (!row) return DEFAULT_SETTINGS;
  const enabled = Array.isArray(row.flutterwaveEnabledCurrenciesJson)
    ? row.flutterwaveEnabledCurrenciesJson.filter(
        (value): value is MketyFlutterwaveCurrency => typeof value === 'string' && CURRENCY_SET.has(value),
      )
    : [];
  const enabledCurrencies = enabled.includes('USD') ? enabled : ['USD', ...enabled];
  const rates: Partial<Record<MketyFlutterwaveCurrency, string>> = {};
  const rawRates = row.flutterwaveFxRatesJson ?? {};
  for (const currency of DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES) {
    if (currency === 'USD') continue;
    const raw = rawRates[currency];
    if (typeof raw !== 'string' || !/^\d+(?:\.\d{1,8})?$/.test(raw)) continue;
    if (Number(raw) > 0) rates[currency] = raw;
  }
  const fxMarkupBps = Number.isInteger(row.flutterwaveFxMarkupBps)
    ? Math.min(5000, Math.max(0, row.flutterwaveFxMarkupBps))
    : 0;
  return { baseCurrency: 'USD', enabledCurrencies, fxRates: rates, fxMarkupBps };
}

export async function getMketyPaymentSettings(): Promise<MketyPaymentSettings> {
  const [row] = await db
    .select()
    .from(platformPaymentSettings)
    .where(eq(platformPaymentSettings.environment, 'production'))
    .limit(1);
  return normalizeSettings(row);
}

function parseDecimalRate(value: string) {
  const [whole, fraction = ''] = value.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * scale + BigInt(fraction || '0');
  return { numerator, scale };
}

function rateWithMarkup(rate: string, markupBps: number) {
  const { numerator, scale } = parseDecimalRate(rate);
  const markedNumerator = numerator * BigInt(10_000 + markupBps);
  const markedScale = scale * 10_000n;
  return { numerator: markedNumerator, scale: markedScale };
}

export function quoteMketyFlutterwaveCurrency(input: {
  canonicalAmountMinor: bigint;
  collectionCurrency: string;
  settings: MketyPaymentSettings;
}) {
  const currency = input.collectionCurrency.toUpperCase() as MketyFlutterwaveCurrency;
  if (!CURRENCY_SET.has(currency) || !input.settings.enabledCurrencies.includes(currency)) {
    throw new Error('Selected Flutterwave currency is not enabled.');
  }
  if (currency === 'USD') {
    return {
      amountMinor: input.canonicalAmountMinor,
      currency,
      baseRate: '1',
      markupBps: 0,
      source: 'identity' as const,
    };
  }

  const rate = input.settings.fxRates[currency];
  if (!rate) throw new Error(`Mkety FX rate is not configured for ${currency}.`);

  const { numerator, scale } = rateWithMarkup(rate, input.settings.fxMarkupBps);
  const raw = input.canonicalAmountMinor * numerator;
  const amountMinor = (raw + scale - 1n) / scale;

  return {
    amountMinor,
    currency,
    baseRate: rate,
    markupBps: input.settings.fxMarkupBps,
    source: 'platform-admin' as const,
  };
}

export async function saveMketyPaymentSettings(input: {
  enabledCurrencies: string[];
  fxRates: Record<string, string>;
  fxMarkupBps: number;
  actorId: string;
}) {
  const enabledCurrencies = DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES.filter(
    (currency) => currency === 'USD' || input.enabledCurrencies.includes(currency),
  );
  const fxRates: Record<string, string> = {};
  for (const currency of DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES) {
    if (currency === 'USD') continue;
    const value = String(input.fxRates[currency] ?? '').trim();
    if (!value) continue;
    if (!/^\d+(?:\.\d{1,8})?$/.test(value) || Number(value) <= 0) {
      throw new Error(`Invalid ${currency} FX rate.`);
    }
    fxRates[currency] = value;
  }
  const fxMarkupBps = Number(input.fxMarkupBps);
  if (!Number.isInteger(fxMarkupBps) || fxMarkupBps < 0 || fxMarkupBps > 5000) {
    throw new Error('FX markup must be between 0 and 50%.');
  }

  const [saved] = await db
    .insert(platformPaymentSettings)
    .values({
      environment: 'production',
      baseCurrency: 'USD',
      flutterwaveEnabledCurrenciesJson: enabledCurrencies,
      flutterwaveFxRatesJson: fxRates,
      flutterwaveFxMarkupBps: fxMarkupBps,
      updatedBy: input.actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformPaymentSettings.environment,
      set: {
        flutterwaveEnabledCurrenciesJson: enabledCurrencies,
        flutterwaveFxRatesJson: fxRates,
        flutterwaveFxMarkupBps: fxMarkupBps,
        updatedBy: input.actorId,
        updatedAt: new Date(),
      },
    })
    .returning();

  return normalizeSettings(saved);
}
