/** @jest-environment node */

const mockPaymentSettings = jest.fn();

jest.mock('@/features/payments/settings', () => ({
  getMketyPaymentSettings: mockPaymentSettings,
}));

import { POST } from './route';

describe('POST /api/payments/flutterwave/start', () => {
  const previousBroker = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const previousStandardSecret = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const previousStandardHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const previousFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET = 'x'.repeat(40);
    process.env.FLUTTERWAVE_STANDARD_SECRET_KEY = 'FLWSECK_TEST-example';
    process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH = 'standard-hash';
    mockPaymentSettings.mockResolvedValue({
      baseCurrency: 'USD',
      nowpayments: { checkoutExperience: 'hosted' },
      flutterwave: {
        checkoutExperience: 'inline',
        fxRates: { NGN: '1500', GHS: '15', KES: '130' },
        fxMarkupBps: 0,
      },
      kora: { checkoutExperience: 'embedded' },
    });
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
        canonical_amount_usd: 39.99,
        requested_payment_currency: 'USD',
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

  it('creates a hosted Flutterwave v3 checkout for the Media handoff', async () => {
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
      checkout_url: 'https://checkout.flutterwave.com/v3/hosted/pay/example',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/payments',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('quotes the Media handoff from database-managed local collection pricing', async () => {
    const ngnRequest = new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'x'.repeat(40)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        canonical_amount_usd: 39.99,
        requested_payment_currency: 'NGN',
        email: 'billing@example.com',
        customer_name: 'Example Business',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://media.mkety.com/billing?payment=processing&provider=flutterwave',
      }),
    });

    const response = await POST(ngnRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      amount: 59985,
      checkout_amount: 59985,
      currency: 'NGN',
      checkout_currency: 'NGN',
      fx_rate: '1500',
      fx_markup_bps: 0,
      fx_source: 'configured',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const checkoutBody = JSON.parse(init.body);
    expect(checkoutBody).toMatchObject({
      amount: '59985.00',
      currency: 'NGN',
      tx_ref: 'MKM-A83K27',
      meta: expect.objectContaining({
        source: 'media',
        provider_currency: 'NGN',
        fx_rate: '1500',
        fx_markup_bps: 0,
        fx_source: 'configured',
      }),
    });
  });

  it('applies the configured FX markup before the provider checkout is created', async () => {
    mockPaymentSettings.mockResolvedValue({
      baseCurrency: 'USD',
      nowpayments: { checkoutExperience: 'hosted' },
      flutterwave: {
        checkoutExperience: 'inline',
        fxRates: { NGN: '1500' },
        fxMarkupBps: 200,
      },
      kora: { checkoutExperience: 'embedded' },
    });

    const ngnRequest = new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'x'.repeat(40)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        canonical_amount_usd: 10,
        requested_payment_currency: 'NGN',
        email: 'billing@example.com',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://media.mkety.com/billing?payment=processing&provider=flutterwave',
      }),
    });

    const response = await POST(ngnRequest);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      checkout_amount: 15300,
      checkout_currency: 'NGN',
      fx_markup_bps: 200,
    });
  });

  it('fails closed when Media requests a collection currency without an approved Mkety FX rate', async () => {
    mockPaymentSettings.mockResolvedValue({
      baseCurrency: 'USD',
      nowpayments: { checkoutExperience: 'hosted' },
      flutterwave: {
        checkoutExperience: 'inline',
        fxRates: {},
        fxMarkupBps: 0,
      },
      kora: { checkoutExperience: 'embedded' },
    });

    const ngnRequest = new Request('https://mkety.com/api/payments/flutterwave/start', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'x'.repeat(40)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'media',
        reference: 'MKM-A83K27',
        canonical_amount_usd: 39.99,
        requested_payment_currency: 'NGN',
        email: 'billing@example.com',
        invoice_id: 'invoice-1',
        tenant_id: 'tenant-1',
        redirect_url: 'https://media.mkety.com/billing?payment=processing&provider=flutterwave',
      }),
    });

    const response = await POST(ngnRequest);
    expect(response.status).toBe(502);
    expect(global.fetch).not.toHaveBeenCalled();
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
        canonical_amount_usd: 39.99,
        requested_payment_currency: 'USD',
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
