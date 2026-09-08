import { verifyNowPaymentsWebhook } from './nowpayments-webhook';

async function signatureFor(body: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('NOWPayments enterprise webhook', () => {
  const body = JSON.stringify({ order_id: 'MKETY-ENT-1', payment_id: 55, payment_status: 'finished' });

  it('fails closed without a secret or signature', async () => {
    await expect(verifyNowPaymentsWebhook(body, 'abc', '')).rejects.toThrow();
    await expect(verifyNowPaymentsWebhook(body, null, 'secret')).rejects.toThrow();
  });

  it('rejects an invalid signature', async () => {
    await expect(verifyNowPaymentsWebhook(body, 'deadbeef', 'secret')).rejects.toThrow('Invalid NOWPayments signature.');
  });

  it('returns parsed data only after valid HMAC verification', async () => {
    const sig = await signatureFor(body, 'secret');
    const event = await verifyNowPaymentsWebhook(body, sig, 'secret');
    expect(event.orderId).toBe('MKETY-ENT-1');
    expect(event.paymentStatus).toBe('finished');
    expect(event.paymentId).toBe('55');
  });
});
