/** @jest-environment node */

import {
  createFlutterwaveHostedCheckout,
  createFlutterwaveInlinePayload,
  getEnabledMketyFlutterwaveCurrencies,
  quoteFlutterwaveCollection,
  verifyFlutterwaveStandardTransaction,
} from './flutterwave-standard';

describe('Flutterwave v3 shared payments', () => {
  it('uses the canonical amount unchanged for USD collection', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'USD',
      }),
    ).resolves.toEqual({
      amountMinor: 3999n,
      currency: 'USD',
      rate: '1',
      markupBps: 0,
      source: 'identity',
    });
  });

  it('uses a database-configured Mkety commercial FX rate', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'NGN',
        configuredRates: { NGN: '1500' },
      }),
    ).resolves.toEqual({
      amountMinor: 5998500n,
      currency: 'NGN',
      rate: '1500',
      markupBps: 0,
      source: 'configured',
    });
  });

  it('applies the configured FX markup and rounds upward to the smallest provider unit', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 499n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'GBP',
        configuredRates: { GBP: '0.78125' },
        markupBps: 200,
      }),
    ).resolves.toEqual({
      amountMinor: 398n,
      currency: 'GBP',
      rate: '0.78125',
      markupBps: 200,
      source: 'configured',
    });
  });

  it('fails closed when no explicit Mkety commercial checkout rate exists', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'NGN',
        configuredRates: {},
      }),
    ).rejects.toThrow('not configured');
  });

  it('exposes only USD plus explicitly priced Mkety collection currencies', () => {
    expect(getEnabledMketyFlutterwaveCurrencies({ NGN: '1500', KES: '130' })).toEqual([
      'USD',
      'NGN',
      'KES',
    ]);
    expect(getEnabledMketyFlutterwaveCurrencies({})).toEqual(['USD']);
  });

  it('creates a server-hashed Inline payload without exposing the secret key', async () => {
    const payload = await createFlutterwaveInlinePayload({
      reference: 'SAAS-MKS-ABC123',
      amountMinor: 3999n,
      currency: 'USD',
      email: 'billing@example.com',
      customerName: 'Example',
      redirectPath: '/t/example/billing/checkout?payment=returned',
      metadata: { source: 'saas' },
      publicKey: 'FLWPUBK_TEST-public',
      secretKey: 'FLWSECK_TEST-private',
    });

    expect(payload).toMatchObject({
      publicKey: 'FLWPUBK_TEST-public',
      reference: 'SAAS-MKS-ABC123',
      amount: 39.99,
      currency: 'USD',
      email: 'billing@example.com',
      metadata: { source: 'saas' },
    });
    expect(payload.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain('FLWSECK_TEST-private');
  });

  it('keeps the hosted v3 checkout helper for shared product broker flows', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/example' },
      }),
    });

    const link = await createFlutterwaveHostedCheckout({
      source: 'media',
      reference: 'MEDIA-MKM-ABC123',
      amountMinor: 3999n,
      currency: 'USD',
      email: 'billing@example.com',
      customerName: 'Example',
      redirectUrl: 'https://media.mkety.com/billing',
      metadata: { source: 'media' },
      secretKey: 'FLWSECK_TEST-private',
      fetchImpl: fetchMock,
    });

    expect(link).toBe('https://checkout.flutterwave.com/v3/hosted/pay/example');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      tx_ref: 'MEDIA-MKM-ABC123',
      amount: '39.99',
      currency: 'USD',
      customer: { email: 'billing@example.com', name: 'Example' },
      meta: { source: 'media' },
    });
    expect(body.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain('FLWSECK_TEST-private');
  });

  it('re-queries v3 transactions before settlement', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { id: 91, status: 'successful', tx_ref: 'SAAS-MKS-ABC123' },
      }),
    });

    await expect(
      verifyFlutterwaveStandardTransaction({
        transactionId: 91,
        secretKey: 'secret',
        fetchImpl: fetchMock,
      }),
    ).resolves.toMatchObject({ id: 91, status: 'successful' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.flutterwave.com/v3/transactions/91/verify',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );
  });
});
