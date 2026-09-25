/** @jest-environment node */

import { createFlutterwaveStandardHostedCheckout } from './flutterwave-standard';

describe('createFlutterwaveStandardHostedCheckout', () => {
  it('creates a server-side hosted checkout with Mkety metadata and payload hash', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/example' },
      }),
    });

    await expect(
      createFlutterwaveStandardHostedCheckout({
        secretKey: 'FLWSECK_TEST_example',
        reference: 'MEDIA-MKM-A83K27',
        amountMinor: 946420n,
        currency: 'NGN',
        redirectUrl: 'https://media.mkety.com/billing?payment=returned',
        customer: { email: 'customer@example.com', name: 'Example Customer' },
        metadata: { source: 'media', invoice_id: 'invoice-1' },
        fetchImpl: fetchMock as typeof fetch,
      }),
    ).resolves.toEqual({
      checkoutUrl: 'https://checkout.flutterwave.com/v3/hosted/example',
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      tx_ref: 'MEDIA-MKM-A83K27',
      amount: '9464.20',
      currency: 'NGN',
      redirect_url: 'https://media.mkety.com/billing?payment=returned',
      customer: { email: 'customer@example.com', name: 'Example Customer' },
      meta: { source: 'media', invoice_id: 'invoice-1' },
    });
    expect(body.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(options.headers.Authorization).toBe('Bearer FLWSECK_TEST_example');
  });

  it('rejects non-HTTPS redirects', async () => {
    await expect(
      createFlutterwaveStandardHostedCheckout({
        secretKey: 'secret',
        reference: 'MEDIA-MKM-A83K27',
        amountMinor: 100n,
        currency: 'USD',
        redirectUrl: 'http://example.com',
        customer: { email: 'customer@example.com' },
        metadata: { source: 'media' },
      }),
    ).rejects.toThrow('HTTPS');
  });
});
