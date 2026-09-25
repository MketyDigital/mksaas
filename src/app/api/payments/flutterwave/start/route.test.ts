/** @jest-environment node */

import { POST } from './route';

describe('POST /api/payments/flutterwave/start', () => {
  const previousBroker = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const previousClientId = process.env.FLUTTERWAVE_CLIENT_ID;
  const previousClientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
  const previousWebhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'x'.repeat(40);
    process.env.FLUTTERWAVE_CLIENT_ID = 'client-id';
    process.env.FLUTTERWAVE_CLIENT_SECRET = 'client-secret';
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = 'webhook-secret';
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousBroker;
    process.env.FLUTTERWAVE_CLIENT_ID = previousClientId;
    process.env.FLUTTERWAVE_CLIENT_SECRET = previousClientSecret;
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = previousWebhookSecret;
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

  it('accepts the Media handoff but fails closed until a concrete v4 payment method exists', async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      success: false,
      code: 'flutterwave_v4_payment_method_required',
      reference: 'MKM-A83K27',
    });
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
