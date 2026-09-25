import { verifyFlutterwaveV4Webhook } from './flutterwave-v4';

async function sign(rawBody: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Buffer.from(digest).toString('base64');
}

describe('Flutterwave v4 webhook verification', () => {
  it('verifies the raw request body using the configured secret hash', async () => {
    const rawBody = JSON.stringify({ id: 'webhook-1', type: 'charge.completed', data: { id: 'chg_1' } });
    const signature = await sign(rawBody, 'webhook-secret');

    await expect(verifyFlutterwaveV4Webhook({
      rawBody,
      signature,
      secretHash: 'webhook-secret',
    })).resolves.toEqual(JSON.parse(rawBody));
  });

  it('rejects a forged signature', async () => {
    await expect(verifyFlutterwaveV4Webhook({
      rawBody: '{"id":"webhook-1"}',
      signature: Buffer.alloc(32).toString('base64'),
      secretHash: 'webhook-secret',
    })).rejects.toThrow('Invalid Flutterwave webhook signature');
  });
});
