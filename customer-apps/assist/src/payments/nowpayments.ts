type RecordValue = Record<string, unknown>;

const FIAT_CODES = new Set([
  "aed", "ars", "aud", "brl", "cad", "chf", "clp", "cny", "eur", "gbp", "hkd", "idr", "ils", "inr", "jpy", "krw", "mxn", "myr", "ngn", "nok", "nzd", "php", "pln", "rub", "sek", "sgd", "thb", "try", "uah", "usd", "zar",
]);

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function currencyCode(value: unknown): string {
  if (typeof value === "string") return value.trim().toLowerCase();
  const item = record(value);
  if (!item) return "";
  for (const key of ["code", "currency", "ticker", "symbol", "payment_currency", "pay_currency"]) {
    if (typeof item[key] === "string") return String(item[key]).trim().toLowerCase();
  }
  return "";
}

export function normalizeNowPaymentsCurrencies(payload: unknown): string[] {
  const root = record(payload);
  const values = Array.isArray(payload)
    ? payload
    : ["selectedCurrencies", "currencies", "coins", "data"].map((key) => root?.[key]).find(Array.isArray) ?? [];
  const result: string[] = [];
  for (const item of values as unknown[]) {
    const code = currencyCode(item);
    if (!/^[a-z0-9]{2,32}$/.test(code) || FIAT_CODES.has(code) || result.includes(code)) continue;
    result.push(code);
  }
  return result;
}

export function chooseDefaultNowPaymentsCurrency(currencies: string[]): string {
  const normalized = currencies.map((value) => value.toLowerCase());
  for (const preferred of ["usdtton", "usdttrc20"]) {
    if (normalized.includes(preferred)) return preferred;
  }
  return normalized[0] || "";
}

export function buildNowPaymentsInvoicePayload(input: {
  amountUsd: number;
  currency?: string;
  reference: string;
  description: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return {
    price_amount: input.amountUsd,
    price_currency: "usd",
    ...(input.currency ? { pay_currency: input.currency.trim().toLowerCase() } : {}),
    is_fixed_rate: true,
    is_fee_paid_by_user: true,
    order_id: input.reference,
    order_description: input.description,
    ipn_callback_url: input.callbackUrl,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

function amountMinor(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number((fraction + "00").slice(0, 2));
  const thirdDigit = Number(fraction[2] || 0);
  const amount = Number(whole) * 100 + cents + (thirdDigit >= 5 ? 1 : 0);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function canApproveNowPaymentsPartial(payment: unknown, checkout: {
  reference: string;
  canonical_currency: string;
  canonical_amount_minor: number;
}): boolean {
  const row = record(payment);
  if (!row || !/^\d{1,24}$/.test(String(row.payment_id ?? ""))) return false;
  if (String(row.order_id ?? "") !== checkout.reference) return false;
  if (String(row.payment_status ?? "").toLowerCase() !== "partially_paid") return false;
  if (String(row.price_currency ?? "").toLowerCase() !== checkout.canonical_currency.toLowerCase()) return false;
  if (amountMinor(row.price_amount) !== checkout.canonical_amount_minor) return false;
  const receivedFiatMinor = amountMinor(row.actually_paid_fiat);
  return receivedFiatMinor !== null && receivedFiatMinor >= checkout.canonical_amount_minor;
}
