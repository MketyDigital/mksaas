/** @jest-environment node */

const mockVerify = jest.fn();
const mockRetrieve = jest.fn();
const mockForward = jest.fn();
const mockRoute = jest.fn();

jest.mock('@/features/payments/kora', () => ({
  verifyKoraWebhook: mockVerify,
  retrieveKoraCharge: mockRetrieve,
}));
jest.mock('@/features/payments/external-webhook-forwarder', () => ({
  forwardOriginalProviderWebhook: mockForward,
}));
jest.mock('@/features/payments/settlement-router', () => ({
  routeVerifiedMketyPayment: mockRoute,
}));

import { POST } from './route';

describe('POST /api/payments/kora/webhook', () => {
  const previousSecret = process.env.KORA_SECRET_KEY;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.KORA_SECRET_KEY = 'sk_test_kora';
  });

  afterAll(() => {
    process.env.KORA_SECRET_KEY = previousSecret;
  });

  it('re-queries and forwards a verified Media success with the unchanged body/signature', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'MKM-A83K27',
        status: 'success',
        amount: 39.99,
        currency: 'USD',
      },
    });
    mockRetrieve.mockResolvedValue({
      reference: 'MKM-A83K27',
      status: 'success',
      amount: 39.99,
      amount_paid: 39.99,
      currency: 'USD',
    });
    mockForward.mockResolvedValue({
      forwarded: true,
      destination: 'https://media.mkety.com/api/billing/kora/webhook',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/kora/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-korapay-signature': 'kora-signature',
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith({
      data: JSON.parse(rawBody).data,
      signature: 'kora-signature',
      secretKey: 'sk_test_kora',
    });
    expect(mockRetrieve).toHaveBeenCalledWith({
      reference: 'MKM-A83K27',
      secretKey: 'sk_test_kora',
    });
    expect(mockForward).toHaveBeenCalledWith({
      source: 'media',
      provider: 'kora',
      rawBody,
      signature: 'kora-signature',
      contentType: 'application/json',
    });
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('rejects a webhook whose re-queried reference does not match', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'MKM-A83K27', status: 'success', amount: 39.99, currency: 'USD' },
    });
    mockRetrieve.mockResolvedValue({
      reference: 'MKM-DIFFERENT',
      status: 'success',
      amount_paid: 39.99,
      currency: 'USD',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/kora/webhook', {
        method: 'POST',
        headers: { 'x-korapay-signature': 'kora-signature' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(400);
    expect(mockForward).not.toHaveBeenCalled();
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('acknowledges a non-success Media charge without forwarding settlement', async () => {
    const rawBody = JSON.stringify({
      event: 'charge.failed',
      data: { reference: 'MKM-A83K27', status: 'failed', amount: 39.99, currency: 'USD' },
    });
    mockRetrieve.mockResolvedValue({
      reference: 'MKM-A83K27',
      status: 'failed',
      amount_paid: 0,
      currency: 'USD',
    });

    const response = await POST(
      new Request('https://mkety.com/api/payments/kora/webhook', {
        method: 'POST',
        headers: { 'x-korapay-signature': 'kora-signature' },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ settled: false, ignored: true, status: 'failed' });
    expect(mockForward).not.toHaveBeenCalled();
  });
});
