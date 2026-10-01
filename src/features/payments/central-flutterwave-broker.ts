import type { MketyPaymentSource } from './reference';

const DEFAULT_BROKER_URL = 'https://mkety.com/api/payments/flutterwave/start';

export interface CentralFlutterwaveCheckoutInput {
  source: Extract<MketyPaymentSource, 'saas' | 'enterprise'>;
  reference: string;
  canonicalAmountMinor: bigint;
  requestedPaymentCurrency?: string;
  email: string;
  customerName?: string;
  tenantId?: string;
  checkoutId?: string;
  orderId?: string;
  redirectUrl: string;
}

export interface CentralFlutterwaveInlinePayload {
  publicKey: string;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  customerName?: string;
  redirectPath: string;
  metadata: Record<string, unknown>;
  payloadHash: string;
}

export interface CentralFlutterwaveCheckoutResult {
  experience: 'inline' | 'hosted';
  inline?: CentralFlutterwaveInlinePayload;
  checkoutUrl?: string;
  providerAmountMinor: bigint;
  providerCurrency: string;
}

function decimalToMinor(value: unknown): bigint {
  const raw = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Mkety payment broker returned an invalid amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

export async function createCentralFlutterwaveCheckout(
  input: CentralFlutterwaveCheckoutInput,
  options: {
    brokerSecret?: string;
    brokerUrl?: string;
    fetchImpl?: typeof fetch;
    experience?: 'inline' | 'hosted';
  },
): Promise<CentralFlutterwaveCheckoutResult> {
  if (!options.brokerSecret) throw new Error('Mkety Flutterwave payment broker is not configured.');
  if (!input.email) throw new Error('Flutterwave checkout requires a customer email.');

  const fetchImpl = options.fetchImpl ?? fetch;
  const requestedExperience = options.experience ?? 'inline';
  const response = await fetchImpl(options.brokerUrl ?? DEFAULT_BROKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.brokerSecret}`,
    },
    body: JSON.stringify({
      source: input.source,
      reference: input.reference,
      canonical_amount_usd: (Number(input.canonicalAmountMinor) / 100).toFixed(2),
      requested_payment_currency: String(input.requestedPaymentCurrency ?? 'USD').toUpperCase(),
      email: input.email,
      customer_name: input.customerName,
      tenant_id: input.tenantId,
      checkout_id: input.checkoutId,
      order_id: input.orderId,
      redirect_url: input.redirectUrl,
      checkout_experience: requestedExperience,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    checkout_experience?: string;
    inline?: CentralFlutterwaveInlinePayload;
    url?: string;
    checkout_url?: string;
    provider_amount_minor?: string;
    checkout_amount?: number | string;
    provider_currency?: string;
    checkout_currency?: string;
  } | null;

  if (!response.ok || !payload?.success) {
    const detail = String(payload?.message ?? 'Flutterwave checkout could not be prepared.').slice(0, 180);
    throw new Error(detail);
  }

  const providerAmountMinor = payload.provider_amount_minor
    ? BigInt(payload.provider_amount_minor)
    : decimalToMinor(payload.checkout_amount);
  const providerCurrency = String(payload.provider_currency ?? payload.checkout_currency ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(providerCurrency)) {
    throw new Error('Mkety payment broker returned an invalid currency.');
  }

  if (payload.checkout_experience === 'inline' && payload.inline) {
    return {
      experience: 'inline',
      inline: payload.inline,
      providerAmountMinor,
      providerCurrency,
    };
  }

  const checkoutUrl = String(payload.checkout_url ?? payload.url ?? '');
  if (!checkoutUrl.startsWith('https://')) {
    throw new Error('Mkety payment broker returned an invalid checkout handoff.');
  }

  return {
    experience: 'hosted',
    checkoutUrl,
    providerAmountMinor,
    providerCurrency,
  };
}
