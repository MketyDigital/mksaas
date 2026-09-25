export interface FlutterwaveStandardCheckoutInput {
  secretKey: string;
  reference: string;
  amountMinor: bigint;
  currency: string;
  redirectUrl: string;
  customer: {
    email: string;
    name?: string;
  };
  metadata: Record<string, unknown>;
  title?: string;
  description?: string;
  fetchImpl?: typeof fetch;
}

function minorToDecimal(amountMinor: bigint): string {
  if (amountMinor <= 0n) throw new Error('Flutterwave checkout amount must be greater than zero.');
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, '0');
  return `${major}.${minor}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildPayloadHash(input: {
  amount: string;
  currency: string;
  email: string;
  reference: string;
  secretKey: string;
}): Promise<string> {
  const secretHash = await sha256Hex(input.secretKey);
  return sha256Hex(`${input.amount}${input.currency}${input.email}${input.reference}${secretHash}`);
}

export async function createFlutterwaveStandardHostedCheckout(
  input: FlutterwaveStandardCheckoutInput,
): Promise<{ checkoutUrl: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Flutterwave checkout currency is invalid.');
  if (!/^[a-zA-Z0-9-]{6,42}$/.test(input.reference)) throw new Error('Flutterwave checkout reference is invalid.');
  if (!input.redirectUrl.startsWith('https://')) throw new Error('Flutterwave redirect URL must use HTTPS.');

  const amount = minorToDecimal(input.amountMinor);
  const payloadHash = await buildPayloadHash({
    amount,
    currency: input.currency,
    email: input.customer.email,
    reference: input.reference,
    secretKey: input.secretKey,
  });

  const response = await fetchImpl('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      customer: {
        email: input.customer.email,
        ...(input.customer.name ? { name: input.customer.name } : {}),
      },
      meta: input.metadata,
      customizations: {
        title: input.title ?? 'Mkety',
        description: input.description ?? 'Mkety payment',
        logo: 'https://mkety.com/icon.png',
      },
      payload_hash: payloadHash,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    data?: { link?: string };
  } | null;
  const checkoutUrl = payload?.data?.link;
  if (!response.ok || payload?.status !== 'success' || !checkoutUrl?.startsWith('https://')) {
    throw new Error('Flutterwave hosted checkout creation failed.');
  }

  return { checkoutUrl };
}
