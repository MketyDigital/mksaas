import { verifyNowPaymentsWebhook } from './nowpayments-webhook';

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortObject((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

async function signatureFor(payload: Record<string, unknown>, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const canonicalBody = JSON.stringify(sortObject(payload));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalBody));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('NOWPayments enterprise webhook', () => {
  const payload = {
    payment_status: 'finished',
    order_id: 'MKETY-ENT-1',
    payment_id: 55,
    outcome: { currency: 'usdt', amount: 100 },
  };
  const body = JSON.stringify(payload);

  it('fails closed without a secret or signature', async () => {
    await expect(verifyNowPaymentsWebhook(body, 'abc', '')).rejects.toThrow();
    await expect(verifyNowPaymentsWebhook(body, null, 'secret')).rejects.toThrow();
  });

  it('rejects an invalid signature', async () => {
    await expect(verifyNowPaymentsWebhook(body, 'deadbeef', 'secret')).rejects.toThrow('Invalid NOWPayments signature.');
  });

  it('verifies the recursively sorted JSON payload required by NOWPayments', async () => {
    const sig = await signatureFor(payload, 'secret');
    const event = await verifyNowPaymentsWebhook(body, sig, 'secret');
    expect(event.orderId).toBe('MKETY-ENT-1');
    expect(event.paymentStatus).toBe('finished');
    expect(event.paymentId).toBe('55');
  });
});
