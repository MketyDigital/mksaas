/** @jest-environment node */

const mockGetSettings = jest.fn();
const mockQuote = jest.fn();
const mockCreateSession = jest.fn();

jest.mock('@/features/payments/settings', () => ({
  getMketyPaymentSettings: mockGetSettings,
  quoteMketyFlutterwaveCurrency: mockQuote,
}));
jest.mock('@/features/payments/server/flutterwave-inline-session', () => ({
  createFlutterwaveInlineSession: mockCreateSession,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/start', () => {
  const previousBroker = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const previousPublic = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const previousSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'x'.repeat(40);
    process.env.FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-example';
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'FLWSECK_TEST-example';
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = 'standard-hash';
    mockGetSettings.mockResolvedValue({
      baseCurrency: 'USD',
      enabledCurrencies: ['USD', 'NGN'],
      fxRates: { NGN: '1500' },
      fxMarkupBps: 0,
    });
    mockQuote.mockImplementation(({ canonicalAmountMinor, collectionCurrency }) => ({
      amountMinor: collectionCurrency === 'NGN' ? canonicalAmountMinor * 1500n : canonicalAmountMinor,
      currency: collectionCurrency,
      baseRate: collectionCurrency === 'NGN' ? '1500' : '1',
      markupBps: 0,
      source: collectionCurrency === 'NGN' ? 'platform-admin' : 'identity',
    }));
    mockCreateSession.mockResolvedValue({
      id: 'session-id',
      url: 'https://mkety.com/pay/flutterwave?session=session-id',
      expiresAt: new Date('2026-09-26T10:00:00.000Z'),
    });
  });

  afterAll(() => {
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = previousBroker;
    process.env.FLUTTERWAVE_PUBLIC_KEY = previousPublic;
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = previousSecret;
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = previousHash;
  });

  function request(secret = 'x'.repeat(40), currency = 'USD') {
    return new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        canonical_amount_usd: 39.99,
        requested_payment_currency: currency,
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

  it('returns a central Mkety Inline session for Media', async () => {
    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      reference: 'MKM-A83K27',
      canonical_currency: 'USD',
      provider_currency: 'USD',
      currency: 'USD',
      checkout_currency: 'USD',
      amount: 39.99,
      checkout_amount: 39.99,
      checkout_url: 'https://mkety.com/pay/flutterwave?session=session-id',
    });
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'media',
        reference: 'MKM-A83K27',
        collectionAmountMinor: 3999n,
        collectionCurrency: 'USD',
      }),
    );
  });

  it('returns the exact admin-quoted local amount for Media', async () => {
    const response = await POST(request('x'.repeat(40), 'NGN'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      amount: 59985,
      checkout_amount: 59985,
      currency: 'NGN',
      checkout_currency: 'NGN',
      fx_rate: '1500',
      fx_source: 'platform-admin',
    });
  });

  it('fails closed when the requested currency has no valid Mkety quote', async () => {
    mockQuote.mockImplementationOnce(() => {
      throw new Error('Mkety FX rate is not configured for NGN.');
    });
    const response = await POST(request('x'.repeat(40), 'NGN'));
    expect(response.status).toBe(502);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('rejects redirects outside the owning Mkety product', async () => {
    const bad = new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'x'.repeat(40)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        canonical_amount_usd: 39.99,
        requested_payment_currency: 'USD',
        email: 'billing@example.com',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://evil.example/steal',
      }),
    });

    const response = await POST(bad);
    expect(response.status).toBe(400);
  });
});
