import { quoteFlutterwaveV4Collection, verifyFlutterwaveV4Webhook } from './flutterwave-v4';

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

  it('uses OAuth v4 to quote the source amount needed for a local-currency collection', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'oauth-token', expires_in: 600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: {
            rate: '0.000707',
            source: { amount: '56562.942008', currency: 'NGN' },
            destination: { amount: '39.99', currency: 'USD' },
          },
        }),
      });

    await expect(
      quoteFlutterwaveV4Collection({
        sourceCurrency: 'NGN',
        destinationCurrency: 'USD',
        destinationAmount: '39.99',
        clientId: 'fx-test-client',
        clientSecret: 'fx-test-secret',
        fetchImpl: fetchMock as typeof fetch,
      }),
    ).resolves.toEqual({ sourceAmount: '56562.942008', rate: '0.000707' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://f4bexperience.flutterwave.com/transfers/rates',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer oauth-token' }),
      }),
    );
    const [, secondInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(secondInit.body)).toEqual({
      source: { currency: 'NGN' },
      destination: { currency: 'USD', amount: 39.99 },
    });
  });

  it('rejects a forged signature', async () => {
    await expect(verifyFlutterwaveV4Webhook({
      rawBody: '{"id":"webhook-1"}',
      signature: Buffer.alloc(32).toString('base64'),
      secretHash: 'webhook-secret',
    })).rejects.toThrow('Invalid Flutterwave webhook signature');
  });
});
