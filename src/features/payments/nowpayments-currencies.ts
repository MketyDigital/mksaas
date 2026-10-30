const CURRENCIES_ENDPOINT = 'https://api.nowpayments.io/v1/currencies';
const TICKER = /^[A-Z0-9]{2,24}$/;

export function normalizeNowPaymentsCurrencies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const ticker = item.trim().toUpperCase();
    return TICKER.test(ticker) ? [ticker] : [];
  }))];
}

export function defaultNowPaymentsCurrency(currencies: readonly string[]): string | null {
  const normalized = normalizeNowPaymentsCurrencies(currencies);
  return normalized.includes('USDTTON')
    ? 'USDTTON'
    : normalized.includes('USDTTRC20')
      ? 'USDTTRC20'
      : normalized[0] ?? null;
}

export async function fetchNowPaymentsCurrencies(input: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;
  const response = await fetchImpl(CURRENCIES_ENDPOINT, {
    headers: { 'x-api-key': input.apiKey },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error('NOWPayments currency list is unavailable.');
  const payload = await response.json().catch(() => null) as { currencies?: unknown } | null;
  const currencies = normalizeNowPaymentsCurrencies(payload?.currencies);
  if (!currencies.length) throw new Error('NOWPayments returned no active currencies.');
  return currencies;
}
