import {
  MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES,
  type MketyFlutterwaveCollectionCurrency,
  type MketyFlutterwaveFxRates,
} from './config';
import { buildMketyPaymentMetadata, createMketyPaymentReference } from './reference';

const STANDARD_ENDPOINT = 'https://api.flutterwave.com/v3/payments';

export type MketyFlutterwaveFxQuoteSource = 'identity' | 'configured';

function minorToDecimal(value: bigint): string {
  const units = value / 100n;
  const cents = (value % 100n).toString().padStart(2, '0');
  return `${units}.${cents}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createFlutterwavePayloadHash(input: {
  amount: string;
  currency: string;
  email: string;
  reference: string;
  secretKey: string;
}) {
  const hashedSecret = await sha256Hex(input.secretKey);
  return sha256Hex(`${input.amount}${input.currency}${input.email}${input.reference}${hashedSecret}`);
}

export function isMketyFlutterwaveCollectionCurrency(value: string): value is MketyFlutterwaveCollectionCurrency {
  return (MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES as readonly string[]).includes(value);
}

export function getConfiguredMketyFxRates(
  value: unknown,
): MketyFlutterwaveFxRates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed = value as Record<string, unknown>;
  const result: MketyFlutterwaveFxRates = {};
  for (const currency of MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES) {
    if (currency === 'USD') continue;
    const raw = parsed[currency];
    const normalized = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
    if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) continue;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric) && numeric > 0) result[currency] = normalized;
  }
  return result;
}

export function getEnabledMketyFlutterwaveCurrencies(
  configuredRates: MketyFlutterwaveFxRates = {},
): MketyFlutterwaveCollectionCurrency[] {
  const configured = getConfiguredMketyFxRates(configuredRates);
  return MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES.filter(
    (currency) => currency === 'USD' || Boolean(configured[currency]),
  );
}

function applyConfiguredRate(canonicalAmountMinor: bigint, rate: string, markupBps: number): bigint {
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * scale + BigInt(fraction || '0');
  const markupNumerator = BigInt(10_000 + markupBps);
  const denominator = scale * 10_000n;
  // Round upward to the smallest provider currency unit so Mkety is never under-collected.
  return (canonicalAmountMinor * numerator * markupNumerator + denominator - 1n) / denominator;
}

export async function quoteFlutterwaveCollection(input: {
  canonicalAmountMinor: bigint;
  canonicalCurrency: 'USD';
  collectionCurrency: MketyFlutterwaveCollectionCurrency;
  configuredRates?: MketyFlutterwaveFxRates;
  markupBps?: number;
}): Promise<{
  amountMinor: bigint;
  currency: MketyFlutterwaveCollectionCurrency;
  rate: string;
  markupBps: number;
  source: MketyFlutterwaveFxQuoteSource;
}> {
  const markupBps = input.markupBps ?? 0;
  if (!Number.isInteger(markupBps) || markupBps < 0 || markupBps > 5000) {
    throw new Error('Mkety checkout FX markup is invalid.');
  }

  if (input.collectionCurrency === input.canonicalCurrency) {
    return {
      amountMinor: input.canonicalAmountMinor,
      currency: input.collectionCurrency,
      rate: '1',
      markupBps: 0,
      source: 'identity',
    };
  }

  const rate = getConfiguredMketyFxRates(input.configuredRates)[input.collectionCurrency];
  if (rate) {
    return {
      amountMinor: applyConfiguredRate(input.canonicalAmountMinor, rate, markupBps),
      currency: input.collectionCurrency,
      rate,
      markupBps,
      source: 'configured',
    };
  }

  throw new Error(`Mkety checkout FX rate is not configured for ${input.collectionCurrency}.`);
}

export async function createFlutterwaveInlinePayload(input: {
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  customerName?: string;
  redirectPath: string;
  metadata: Record<string, unknown>;
  publicKey: string;
  secretKey: string;
}) {
  const amount = Number(minorToDecimal(input.amountMinor));
  const payloadHash = await createFlutterwavePayloadHash({
    amount: String(amount),
    currency: input.currency,
    email: input.email,
    reference: input.reference,
    secretKey: input.secretKey,
  });

  return {
    publicKey: input.publicKey,
    reference: input.reference,
    amount,
    currency: input.currency,
    email: input.email,
    customerName: input.customerName,
    redirectPath: input.redirectPath,
    metadata: input.metadata,
    payloadHash,
  };
}

export async function createFlutterwaveHostedCheckout(input: {
  source: 'saas' | 'media' | 'enterprise' | 'host';
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  customerName?: string;
  redirectUrl: string;
  metadata: Record<string, unknown>;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const amount = minorToDecimal(input.amountMinor);
  const payloadHash = await createFlutterwavePayloadHash({
    amount,
    currency: input.currency,
    email: input.email,
    reference: input.reference,
    secretKey: input.secretKey,
  });
  const response = await fetchImpl(STANDARD_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount,
      currency: input.currency,
      payload_hash: payloadHash,
      redirect_url: input.redirectUrl,
      customer: { email: input.email, ...(input.customerName ? { name: input.customerName } : {}) },
      customizations: {
        title: input.source === 'media' ? 'Mkety Media' : 'Mkety',
        description: 'Secure Mkety payment',
        logo: 'https://mkety.com/icon.png',
      },
      meta: input.metadata,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { status?: string; data?: { link?: string } } | null;
  const link = String(payload?.data?.link ?? '');
  if (!response.ok || payload?.status !== 'success' || !link.startsWith('https://')) {
    throw new Error('Flutterwave hosted checkout creation failed.');
  }
  return link;
}

export function createSaasFlutterwaveReference(checkoutId: string) {
  return createMketyPaymentReference('saas', checkoutId);
}

export function createSaasFlutterwaveMetadata(checkoutId: string, tenantId: string) {
  return buildMketyPaymentMetadata({ source: 'saas', checkoutId, tenantId });
}

export async function verifyFlutterwaveStandardTransaction(input: {
  transactionId: string | number;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(input.transactionId))}/verify`,
    { headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' } },
  );
  const payload = (await response.json().catch(() => null)) as { status?: string; data?: Record<string, unknown> } | null;
  if (!response.ok || payload?.status !== 'success' || !payload.data) {
    throw new Error('Flutterwave Standard transaction verification failed.');
  }
  return payload.data;
}
