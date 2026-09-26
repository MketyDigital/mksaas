/** @jest-environment node */

const mockForward = jest.fn();
const mockRoute = jest.fn();
const mockStandardVerify = jest.fn();
const mockAttestation = jest.fn();
const mockMarkVerified = jest.fn();

jest.mock('@/features/payments/flutterwave-standard', () => ({
  verifyFlutterwaveStandardTransaction: mockStandardVerify,
}));
jest.mock('@/features/payments/external-webhook-forwarder', () => ({
  forwardOriginalProviderWebhook: mockForward,
}));
jest.mock('@/features/payments/settlement-router', () => ({
  routeVerifiedMketyPayment: mockRoute,
}));
jest.mock('@/features/payments/server/flutterwave-inline-session', () => ({
  markFlutterwaveInlineSessionVerified: mockMarkVerified,
}));
jest.mock('@/features/payments/attestation', () => ({
  createMketyPaymentAttestation: mockAttestation,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/webhook', () => {
  const previousStandardSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousStandardHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const previousBrokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'standard-secret';
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = 'standard-hash';
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'b'.repeat(40);
    mockAttestation.mockResolvedValue('signed-attestation');
    mockMarkVerified.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = previousStandardSecret;
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = previousStandardHash;
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousBrokerSecret;
  });

  it('rejects webhook requests with the wrong verif-hash', async () => {
    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'verif-hash': 'wrong' },
        body: JSON.stringify({ event: 'charge.completed', data: { id: 1 } }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mockStandardVerify).not.toHaveBeenCalled();
  });

  it('acknowledges non-charge events without settlement', async () => {
    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'verif-hash': 'standard-hash' },
        body: JSON.stringify({ event: 'transfer.completed', data: { id: 88 } }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, ignored: true, mode: 'v3' });
    expect(mockStandardVerify).not.toHaveBeenCalled();
  });

  it('re-queries and settles a canonical SaaS payment locally', async () => {
    const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';
    const rawBody = JSON.stringify({
      event: 'charge.completed',
      data: {
        id: 88221,
        tx_ref: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
        status: 'successful',
        amount: 48.42,
        currency: 'USD',
      },
    });
    mockStandardVerify.mockResolvedValue({
      id: 88221,
      tx_ref: 'SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91',
      status: 'successful',
      amount: 48.42,
      currency: 'USD',
      meta: { source: 'saas', checkout_id: checkoutId },
    });
    mockRoute.mockResolvedValue({ settled: true, status: 'applied' });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'verif-hash': 'standard-hash' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockStandardVerify).toHaveBeenCalledWith({ transactionId: '88221', secretKey: 'standard-secret' });
    expect(mockRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'saas',
        targetUuid: checkoutId,
        provider: 'flutterwave',
        status: 'success',
      }),
    );
    expect(mockForward).not.toHaveBeenCalled();
    expect(mockMarkVerified).toHaveBeenCalledWith('SAAS-MKS-5e0d1f406bf54efdbd75a2223fb8ff91');
  });

  it('attests a verified Media payment before forwarding the exact original body', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.completed',
      data: {
        id: 991,
        tx_ref: 'MKM-A83K27',
        status: 'successful',
        amount: 65000,
        currency: 'NGN',
      },
    });
    mockStandardVerify.mockResolvedValue({
      id: 991,
      tx_ref: 'MKM-A83K27',
      status: 'successful',
      amount: 65000,
      currency: 'NGN',
      meta: { source: 'media', invoice_id: 'invoice-1', tenant_id: 'tenant-1' },
    });
    mockForward.mockResolvedValue({
      forwarded: true,
      destination: 'https://media.mkety.com/api/billing/flutterwave/webhook',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'verif-hash': 'standard-hash' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAttestation).toHaveBeenCalledWith(rawBody, 'b'.repeat(40));
    expect(mockForward).toHaveBeenCalledWith({
      source: 'media',
      provider: 'flutterwave',
      rawBody,
      signature: 'standard-hash',
      signatureHeader: 'verif-hash',
      attestation: 'signed-attestation',
      contentType: 'application/json',
    });
    expect(mockRoute).not.toHaveBeenCalled();
    expect(mockMarkVerified).toHaveBeenCalledWith('MKM-A83K27');
  });

  it('rejects forwarding when the webhook fields disagree with the verified transaction', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.completed',
      data: {
        id: 992,
        tx_ref: 'MKM-A83K27',
        status: 'successful',
        amount: 64000,
        currency: 'NGN',
      },
    });
    mockStandardVerify.mockResolvedValue({
      id: 992,
      tx_ref: 'MKM-A83K27',
      status: 'successful',
      amount: 65000,
      currency: 'NGN',
      meta: { source: 'media' },
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'verif-hash': 'standard-hash' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(400);
    expect(mockAttestation).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });
});
