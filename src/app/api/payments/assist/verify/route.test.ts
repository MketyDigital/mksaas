/** @jest-environment node */

const mockAttestation = jest.fn();
const mockFlutterwaveVerify = jest.fn();
const mockKoraRetrieve = jest.fn();

jest.mock('@/features/payments/attestation', () => ({ createMketyPaymentAttestation: mockAttestation }));
jest.mock('@/features/payments/flutterwave-standard', () => ({ verifyFlutterwavePaymentByReference: mockFlutterwaveVerify }));
jest.mock('@/features/payments/kora', () => ({ retrieveKoraCharge: mockKoraRetrieve, resolveKoraPaidAmount: (value: Record<string, unknown>) => value.amount }));

import { POST } from './route';

describe('POST /api/payments/assist/verify', () => {
  const previousSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const previousFlutterwaveSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'broker-secret';
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'flutterwave-secret';
    mockAttestation.mockResolvedValue('signed');
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousSecret;
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = previousFlutterwaveSecret;
    global.fetch = previousFetch;
  });

  it('rejects callers without the internal broker credential', async () => {
    const response = await POST(new Request('https://mkety.com/api/payments/assist/verify', {
      method: 'POST', body: JSON.stringify({ provider: 'flutterwave', reference: 'ASSIST-MKA-123456' }),
    }));

    expect(response.status).toBe(401);
    expect(mockFlutterwaveVerify).not.toHaveBeenCalled();
  });

  it('re-queries the original Flutterwave reference and sends verified data to Assist', async () => {
    mockFlutterwaveVerify.mockResolvedValue({
      id: 234, tx_ref: 'ASSIST-MKA-123456', status: 'successful', amount: 10, currency: 'USD',
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, settled: true }) }) as typeof fetch;

    const response = await POST(new Request('https://mkety.com/api/payments/assist/verify', {
      method: 'POST',
      headers: { authorization: 'Bearer broker-secret', 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'flutterwave', reference: 'ASSIST-MKA-123456' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, status: 'paid' });
    expect(mockFlutterwaveVerify).toHaveBeenCalledWith({ reference: 'ASSIST-MKA-123456', secretKey: 'flutterwave-secret' });
    expect(global.fetch).toHaveBeenCalledWith('https://mkety-assist.mkety.app/api/payment/flutterwave/webhook', expect.objectContaining({
      headers: expect.objectContaining({ 'x-mkety-payment-attestation': 'signed' }),
    }));
  });
});
