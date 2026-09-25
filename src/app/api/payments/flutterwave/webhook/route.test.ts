/** @jest-environment node */

const mockVerifyV4 = jest.fn();
const mockRetrieveV4 = jest.fn();
const mockVerifyV3 = jest.fn();
const mockRetrieveV3 = jest.fn();
const mockForward = jest.fn();
const mockRoute = jest.fn();

jest.mock('@/features/payments/flutterwave-v4', () => ({
  verifyFlutterwaveV4Webhook: mockVerifyV4,
  retrieveFlutterwaveV4Charge: mockRetrieveV4,
}));
jest.mock('@/features/payments/flutterwave-v3', () => ({
  verifyFlutterwaveV3WebhookSecret: mockVerifyV3,
  retrieveFlutterwaveV3Transaction: mockRetrieveV3,
}));
jest.mock('@/features/payments/external-webhook-forwarder', () => ({
  forwardOriginalProviderWebhook: mockForward,
}));
jest.mock('@/features/payments/settlement-router', () => ({
  routeVerifiedMketyPayment: mockRoute,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/webhook', () => {
  const previous = {
    clientId: process.env.FLUTTERWAVE_CLIENT_ID,
    clientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET,
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    v3SecretKey: process.env.FLUTTERWAVE_V3_SECRET_KEY,
    v3SecretHash: process.env.FLUTTERWAVE_V3_SECRET_HASH,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CLIENT_ID = 'client-id';
    process.env.FLUTTERWAVE_CLIENT_SECRET = 'client-secret';
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = 'webhook-secret';
    process.env.FLUTTERWAVE_V3_SECRET_KEY = 'v3-secret-key';
    process.env.FLUTTERWAVE_V3_SECRET_HASH = 'v3-secret-hash';
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CLIENT_ID = previous.clientId;
    process.env.FLUTTERWAVE_CLIENT_SECRET = previous.clientSecret;
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = previous.webhookSecret;
    process.env.FLUTTERWAVE_V3_SECRET_KEY = previous.v3SecretKey;
    process.env.FLUTTERWAVE_V3_SECRET_HASH = previous.v3SecretHash;
  });

  it('forwards the unchanged v4 body and signature for a verified Media payment', async () => {
    const rawBody = JSON.stringify({ id: 'evt-1', type: 'charge.completed', data: { id: 'chg-1' } });
    mockVerifyV4.mockResolvedValue(JSON.parse(rawBody));
    mockRetrieveV4.mockResolvedValue({
      id: 'chg-1',
      reference: 'MKM-A83K27',
      status: 'succeeded',
      amount: 39.99,
      currency: 'USD',
      meta: { source: 'media', invoice_id: 'invoice-1', tenant_id: 'tenant-1' },
    });
    mockForward.mockResolvedValue({
      forwarded: true,
      destination: 'https://media.mkety.com/api/billing/flutterwave/webhook',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'flutterwave-signature': 'provider-signature',
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockForward).toHaveBeenCalledWith({
      source: 'media',
      provider: 'flutterwave',
      rawBody,
      signature: 'provider-signature',
      signatureHeader: 'flutterwave-signature',
      contentType: 'application/json',
    });
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('forwards the unchanged v3 body and verif-hash for Media hosted checkout', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.completed',
      data: { id: 12345 },
    });
    mockRetrieveV3.mockResolvedValue({
      id: 12345,
      tx_ref: 'MKM-A83K27',
      status: 'successful',
      amount: 39.99,
      currency: 'USD',
      meta: { source: 'media', invoice_id: 'invoice-1', tenant_id: 'tenant-1' },
    });
    mockForward.mockResolvedValue({
      forwarded: true,
      destination: 'https://media.mkety.com/api/billing/flutterwave/webhook',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'verif-hash': 'v3-secret-hash',
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockVerifyV3).toHaveBeenCalledWith({
      signature: 'v3-secret-hash',
      secretHash: 'v3-secret-hash',
    });
    expect(mockForward).toHaveBeenCalledWith({
      source: 'media',
      provider: 'flutterwave',
      rawBody,
      signature: 'v3-secret-hash',
      signatureHeader: 'verif-hash',
      contentType: 'application/json',
    });
  });

  it('settles a canonical SaaS reference locally instead of forwarding', async () => {
    const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';
    const rawBody = JSON.stringify({ id: 'evt-2', type: 'charge.completed', data: { id: 'chg-2' } });
    mockVerifyV4.mockResolvedValue(JSON.parse(rawBody));
    mockRetrieveV4.mockResolvedValue({
      id: 'chg-2',
      reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      status: 'succeeded',
      amount: 48.42,
      currency: 'USD',
      meta: { source: 'saas', checkout_id: checkoutId },
    });
    mockRoute.mockResolvedValue({ settled: true, status: 'applied' });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'flutterwave-signature': 'provider-signature' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'saas',
        targetUuid: checkoutId,
        provider: 'flutterwave',
        reference: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
        status: 'success',
      }),
    );
    expect(mockForward).not.toHaveBeenCalled();
  });
});
