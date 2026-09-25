import { buildMketyPaymentMetadata, createMketyPaymentReference } from './reference';

const STANDARD_ENDPOINT = 'https://api.flutterwave.com/v3/payments';

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
] as const;
export type MketyFlutterwaveCollectionCurrency = (typeof MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES)[number];

function minorToDecimal(value: bigint): string {
  const units = value / 100n;
  const cents = (value % 100n).toString().padStart(2, '0');
  return `${units}.${cents}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createFlutterwavePayloadHash(input: {
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

export function getConfiguredMketyFxRates(rawJson = process.env.MKETY_PAYMENT_FX_RATES_JSON): Partial<Record<MketyFlutterwaveCollectionCurrency, string>> {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const result: Partial<Record<MketyFlutterwaveCollectionCurrency, string>> = {};
    for (const currency of MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES) {
      if (currency === 'USD') continue;
      const raw = parsed[currency];
      const normalized = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
      if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) continue;
      const numeric = Number(normalized);
      if (Number.isFinite(numeric) && numeric > 0) result[currency] = normalized;
    }
    return result;
  } catch {
    return {};
  }
}

export function getEnabledMketyFlutterwaveCurrencies(
  rawJson = process.env.MKETY_PAYMENT_FX_RATES_JSON,
): MketyFlutterwaveCollectionCurrency[] {
  const configured = getConfiguredMketyFxRates(rawJson);
  return MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES.filter(
    (currency) => currency === 'USD' || Boolean(configured[currency]),
  );
}

function applyConfiguredRate(canonicalAmountMinor: bigint, rate: string): bigint {
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * scale + BigInt(fraction || '0');
  // Round upward to the smallest provider currency unit so Mkety is never under-collected.
  return (canonicalAmountMinor * numerator + scale - 1n) / scale;
}

export async function quoteFlutterwaveCollection(input: {
  canonicalAmountMinor: bigint;
  canonicalCurrency: 'USD';
  collectionCurrency: MketyFlutterwaveCollectionCurrency;
  configuredRatesJson?: string;
}): Promise<{ amountMinor: bigint; currency: MketyFlutterwaveCollectionCurrency; rate: string; source: 'identity' | 'configured' }> {
  if (input.collectionCurrency === input.canonicalCurrency) {
    return { amountMinor: input.canonicalAmountMinor, currency: input.collectionCurrency, rate: '1', source: 'identity' };
  }

  const rate = getConfiguredMketyFxRates(input.configuredRatesJson)[input.collectionCurrency];
  if (!rate) {
    throw new Error(`Mkety checkout FX rate is not configured for ${input.collectionCurrency}.`);
  }

  return {
    amountMinor: applyConfiguredRate(input.canonicalAmountMinor, rate),
    currency: input.collectionCurrency,
    rate,
    source: 'configured',
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
