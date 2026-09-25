import { buildMketyPaymentMetadata, createMketyPaymentReference } from './reference';

const STANDARD_ENDPOINT = 'https://api.flutterwave.com/v3/payments';
const TRANSFER_RATES_ENDPOINT = 'https://api.flutterwave.com/v3/transfers/rates';

export const MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES = ['USD','NGN','GHS','KES','GBP','EUR'] as const;
export type MketyFlutterwaveCollectionCurrency = (typeof MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES)[number];

function decimalToMinor(value: unknown): bigint {
  const raw = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Flutterwave returned an invalid FX amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2,'0') || '0');
}

function minorToDecimal(value: bigint): string {
  const units = value / 100n;
  const cents = (value % 100n).toString().padStart(2,'0');
  return `${units}.${cents}`;
}

export function isMketyFlutterwaveCollectionCurrency(value: string): value is MketyFlutterwaveCollectionCurrency {
  return (MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES as readonly string[]).includes(value);
}

export async function quoteFlutterwaveCollection(input: {
  canonicalAmountMinor: bigint;
  canonicalCurrency: 'USD';
  collectionCurrency: MketyFlutterwaveCollectionCurrency;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ amountMinor: bigint; currency: MketyFlutterwaveCollectionCurrency; rate?: string }> {
  if (input.collectionCurrency === input.canonicalCurrency) {
    return { amountMinor: input.canonicalAmountMinor, currency: input.collectionCurrency, rate: '1' };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(TRANSFER_RATES_ENDPOINT);
  url.searchParams.set('amount', minorToDecimal(input.canonicalAmountMinor));
  url.searchParams.set('destination_currency', input.canonicalCurrency);
  url.searchParams.set('source_currency', input.collectionCurrency);

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' },
  });
  const payload = (await response.json().catch(()=>null)) as any;
  const sourceAmount = payload?.data?.source?.amount;
  if (!response.ok || payload?.status !== 'success' || sourceAmount == null) {
    throw new Error('Flutterwave FX quote failed.');
  }
  return {
    amountMinor: decimalToMinor(sourceAmount),
    currency: input.collectionCurrency,
    rate: payload?.data?.rate == null ? undefined : String(payload.data.rate),
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
  const response = await fetchImpl(STANDARD_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount: minorToDecimal(input.amountMinor),
      currency: input.currency,
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
  const payload = (await response.json().catch(()=>null)) as any;
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
