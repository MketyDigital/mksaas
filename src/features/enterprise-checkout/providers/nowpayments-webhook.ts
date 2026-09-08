export interface VerifiedNowPaymentsEvent {
  orderId: string;
  paymentId?: string;
  paymentStatus: string;
  raw: Record<string, unknown>;
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyNowPaymentsWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<VerifiedNowPaymentsEvent> {
  if (!secret) throw new Error('NOWPayments webhook secret is not configured.');
  if (!signature) throw new Error('NOWPayments signature is required.');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = new Uint8Array(expectedBuffer);
  const received = hexToBytes(signature);
  if (!received || !timingSafeEqual(expected, received)) throw new Error('Invalid NOWPayments signature.');

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const orderId = typeof payload.order_id === 'string' ? payload.order_id : '';
  const paymentStatus = typeof payload.payment_status === 'string' ? payload.payment_status : '';
  if (!orderId || !paymentStatus) throw new Error('NOWPayments event is missing required fields.');

  return {
    orderId,
    paymentId: payload.payment_id == null ? undefined : String(payload.payment_id),
    paymentStatus,
    raw: payload,
  };
}
