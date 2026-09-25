import { verifyKoraWebhook } from './kora';

async function sign(data: unknown, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(data)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('Kora webhook verification', () => {
  it('accepts the HMAC-SHA256 signature over the data object', async () => {
    const data = { reference: 'SAAS-MKS-ABC123', amount: 100 };
    const signature = await sign(data, 'test-secret');

    await expect(verifyKoraWebhook({ data, signature, secretKey: 'test-secret' })).resolves.toBeUndefined();
  });

  it('rejects a forged signature', async () => {
    await expect(verifyKoraWebhook({
      data: { reference: 'SAAS-MKS-ABC123' },
      signature: '00'.repeat(32),
      secretKey: 'test-secret',
    })).rejects.toThrow('Invalid Kora webhook signature');
  });
});
