/** @jest-environment node */

const mockCreateHosted = jest.fn();

jest.mock('@/features/payments/flutterwave-standard', () => ({
  createFlutterwaveStandardHostedCheckout: mockCreateHosted,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/start', () => {
  const previous = {
    broker: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET,
    mode: process.env.FLUTTERWAVE_API_MODE,
    clientId: process.env.FLUTTERWAVE_CLIENT_ID,
    clientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET,
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    v3SecretKey: process.env.FLUTTERWAVE_V3_SECRET_KEY,
    v3SecretHash: process.env.FLUTTERWAVE_V3_SECRET_HASH,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'x'.repeat(40);
    process.env.FLUTTERWAVE_API_MODE = 'v4';
    process.env.FLUTTERWAVE_CLIENT_ID = 'client-id';
    process.env.FLUTTERWAVE_CLIENT_SECRET = 'client-secret';
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = 'webhook-secret';
    delete process.env.FLUTTERWAVE_V3_SECRET_KEY;
    delete process.env.FLUTTERWAVE_V3_SECRET_HASH;
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previous.broker;
    process.env.FLUTTERWAVE_API_MODE = previous.mode;
    process.env.FLUTTERWAVE_CLIENT_ID = previous.clientId;
    process.env.FLUTTERWAVE_CLIENT_SECRET = previous.clientSecret;
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = previous.webhookSecret;
    process.env.FLUTTERWAVE_V3_SECRET_KEY = previous.v3SecretKey;
    process.env.FLUTTERWAVE_V3_SECRET_HASH = previous.v3SecretHash;
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

  it('accepts the Media handoff but fails closed in v4 until a concrete payment method exists', async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      success: false,
      code: 'flutterwave_v4_payment_method_required',
      reference: 'MKM-A83K27',
    });
    expect(mockCreateHosted).not.toHaveBeenCalled();
  });

  it('creates the hosted Media checkout only in explicit v3-hosted mode', async () => {
    process.env.FLUTTERWAVE_API_MODE = 'v3-hosted';
    process.env.FLUTTERWAVE_V3_SECRET_KEY = 'v3-secret-key';
    process.env.FLUTTERWAVE_V3_SECRET_HASH = 'v3-secret-hash';
    mockCreateHosted.mockResolvedValue({ checkoutUrl: 'https://checkout.flutterwave.com/example' });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      checkout_url: 'https://checkout.flutterwave.com/example',
      reference: 'MKM-A83K27',
    });
    expect(mockCreateHosted).toHaveBeenCalledWith(
      expect.objectContaining({
        secretKey: 'v3-secret-key',
        reference: 'MKM-A83K27',
        amountMinor: 3999n,
        currency: 'USD',
        metadata: expect.objectContaining({
          source: 'media',
          invoice_id: 'invoice-1',
          tenant_id: 'tenant-1',
        }),
      }),
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
