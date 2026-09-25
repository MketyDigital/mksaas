/** @jest-environment node */

import { POST } from './route';

describe('POST /api/payments/flutterwave/start', () => {
  const previousBroker = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const previousStandardSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousStandardHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const previousFetch = global.fetch;

  beforeEach(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'x'.repeat(40);
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'FLWSECK_TEST-example';
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = 'standard-hash';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/example' },
      }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = previousFetch;
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousBroker;
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = previousStandardSecret;
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = previousStandardHash;
  });

  function request(secret = 'x'.repeat(40)) {
    return new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        amount: 39.99,
        currency: 'USD',
        email: 'billing@example.com',
        customer_name: 'Example Business',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://media.mkety.com/billing?payment=processing&provider=flutterwave',
      }),
    });
  }

  it('rejects callers without the internal broker secret', async () => {
    const response = await POST(request('wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('creates a hosted Flutterwave checkout for the Media handoff', async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      reference: 'MKM-A83K27',
      canonical_currency: 'USD',
      provider_currency: 'USD',
      checkout_url: 'https://checkout.flutterwave.com/v3/hosted/pay/example',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects redirects outside the owning Mkety product', async () => {
    const requestWithBadRedirect = new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'x'.repeat(40)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        amount: 39.99,
        currency: 'USD',
        email: 'billing@example.com',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://evil.example/steal',
      }),
    });

    const response = await POST(requestWithBadRedirect);
    expect(response.status).toBe(400);
  });
});
