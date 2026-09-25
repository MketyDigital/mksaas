/** @jest-environment node */

const mockVerify = jest.fn();
const mockRetrieve = jest.fn();
const mockForward = jest.fn();
const mockRoute = jest.fn();
const mockStandardVerify = jest.fn();
const mockAttestation = jest.fn();

jest.mock('@/features/payments/flutterwave-v4', () => ({
  verifyFlutterwaveV4Webhook: mockVerify,
  retrieveFlutterwaveV4Charge: mockRetrieve,
}));
jest.mock('@/features/payments/flutterwave-standard', () => ({
  verifyFlutterwaveStandardTransaction: mockStandardVerify,
}));
jest.mock('@/features/payments/external-webhook-forwarder', () => ({
  forwardOriginalProviderWebhook: mockForward,
}));
jest.mock('@/features/payments/settlement-router', () => ({
  routeVerifiedMketyPayment: mockRoute,
}));
jest.mock('@/features/payments/attestation', () => ({
  createMketyPaymentAttestation: mockAttestation,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/webhook', () => {
  const previousClientId = process.env.FLUTTERWAVE_CLIENT_ID;
  const previousClientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
  const previousWebhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  const previousStandardSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousStandardHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const previousBrokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CLIENT_ID = 'client-id';
    process.env.FLUTTERWAVE_CLIENT_SECRET = 'client-secret';
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = 'webhook-secret';
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'standard-secret';
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = 'standard-hash';
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'b'.repeat(40);
    mockAttestation.mockResolvedValue('signed-attestation');
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CLIENT_ID = previousClientId;
    process.env.FLUTTERWAVE_CLIENT_SECRET = previousClientSecret;
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = previousWebhookSecret;
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = previousStandardSecret;
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = previousStandardHash;
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousBrokerSecret;
  });

  it('forwards the unchanged provider body and signature for a verified Media payment', async () => {
    const rawBody = JSON.stringify({
      id: 'evt-1',
      type: 'charge.completed',
      data: { id: 'chg-1' },
    });
    mockVerify.mockResolvedValue(JSON.parse(rawBody));
    mockRetrieve.mockResolvedValue({
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
      attestation: undefined,
      contentType: 'application/json',
    });
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('settles a canonical SaaS reference locally instead of forwarding', async () => {
    const checkoutId = '5e0d1f40-6bf5-4efd-bd75-a2223fb8ff91';
    const rawBody = JSON.stringify({
      id: 'evt-2',
      type: 'charge.completed',
      data: { id: 'chg-2' },
    });
    mockVerify.mockResolvedValue(JSON.parse(rawBody));
    mockRetrieve.mockResolvedValue({
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
  it('accepts Flutterwave Standard verif-hash events on the same central endpoint', async () => {
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
    expect(mockStandardVerify).toHaveBeenCalledWith({
      transactionId: '88221',
      secretKey: 'standard-secret',
    });
    expect(mockRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'saas',
        targetUuid: checkoutId,
        provider: 'flutterwave',
        status: 'success',
      }),
    );
  });

  it('attests a verified Standard Media event before forwarding the unchanged body', async () => {
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
        headers: {
          'content-type': 'application/json',
          'verif-hash': 'standard-hash',
        },
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
  });

  it('rejects Standard forwarding when webhook fields disagree with the re-queried transaction', async () => {
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

  it('acknowledges valid non-charge Flutterwave events without settlement', async () => {
    const rawBody = JSON.stringify({ id: 'evt-other', type: 'customer.updated', data: { id: 'cus-1' } });
    mockVerify.mockResolvedValue(JSON.parse(rawBody));

    const response = await POST(
      new Request('https://mkety.com/api/payments/flutterwave/webhook', {
        method: 'POST',
        headers: { 'flutterwave-signature': 'provider-signature' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, ignored: true, settled: false });
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
    expect(mockRoute).not.toHaveBeenCalled();
  });
});
