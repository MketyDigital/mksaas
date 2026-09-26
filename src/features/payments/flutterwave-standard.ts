import { DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES } from '@/shared/db/schema';

import { buildMketyPaymentMetadata, createMketyPaymentReference } from './reference';

const STANDARD_ENDPOINT = 'https://api.flutterwave.com/v3/payments';

export const MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES = DEFAULT_FLUTTERWAVE_COLLECTION_CURRENCIES;
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

export async function createFlutterwavePayloadHash(input: {
  amountMinor: bigint;
  currency: string;
  email: string;
  reference: string;
  secretKey: string;
}) {
  const amount = minorToDecimal(input.amountMinor);
  const hashedSecret = await sha256Hex(input.secretKey);
  return sha256Hex(`${amount}${input.currency}${input.email}${input.reference}${hashedSecret}`);
}

export function isMketyFlutterwaveCollectionCurrency(value: string): value is MketyFlutterwaveCollectionCurrency {
  return (MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES as readonly string[]).includes(value);
}

export async function buildFlutterwaveInlineConfig(input: {
  publicKey: string;
  secretKey: string;
  source: 'saas' | 'media' | 'enterprise' | 'host';
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  customerName?: string;
  redirectUrl: string;
  metadata: Record<string, unknown>;
}) {
  const payloadHash = await createFlutterwavePayloadHash({
    amountMinor: input.amountMinor,
    currency: input.currency,
    email: input.email,
    reference: input.reference,
    secretKey: input.secretKey,
  });

  return {
    public_key: input.publicKey,
    tx_ref: input.reference,
    amount: Number(minorToDecimal(input.amountMinor)),
    currency: input.currency,
    redirect_url: input.redirectUrl,
    customer: {
      email: input.email,
      ...(input.customerName ? { name: input.customerName } : {}),
    },
    customizations: {
      title: input.source === 'media' ? 'Mkety Media' : 'Mkety',
      description: 'Secure Mkety payment',
      logo: 'https://mkety.com/icon.png',
    },
    meta: input.metadata,
    payload_hash: payloadHash,
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
    amountMinor: input.amountMinor,
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
    throw new Error('Flutterwave transaction verification failed.');
  }
  return payload.data;
}
