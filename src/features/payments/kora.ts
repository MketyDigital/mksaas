function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyKoraWebhook(input: {
  data: unknown;
  signature: string | null;
  secretKey: string;
}): Promise<void> {
  if (!input.signature) throw new Error('Kora webhook signature is required.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(input.data)));
  const expected = toHex(digest);
  if (!timingSafeEqualText(expected, input.signature)) throw new Error('Invalid Kora webhook signature.');
}

export async function retrieveKoraCharge(input: {
  reference: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(input.reference)}`,
    { headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' } },
  );
  const payload = (await response.json().catch(() => null)) as { status?: boolean; data?: Record<string, unknown> } | null;
  if (!response.ok || payload?.status !== true || !payload.data) throw new Error('Kora charge verification failed.');
  return payload.data;
}
