/** @jest-environment node */

import {
  createFlutterwaveHostedCheckout,
  getEnabledMketyFlutterwaveCurrencies,
  quoteFlutterwaveCollection,
  verifyFlutterwaveStandardTransaction,
} from './flutterwave-standard';

describe('Flutterwave Standard shared payments', () => {
  it('uses the canonical amount unchanged for USD collection', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'USD',
      }),
    ).resolves.toEqual({ amountMinor: 3999n, currency: 'USD', rate: '1', source: 'identity' });
  });

  it('uses an explicitly configured Mkety commercial FX rate', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'NGN',
        configuredRatesJson: '{"NGN":"1500"}',
      }),
    ).resolves.toEqual({
      amountMinor: 5998500n,
      currency: 'NGN',
      rate: '1500',
      source: 'configured',
    });
  });

  it('rounds a configured collection quote upward to the smallest provider unit', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 499n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'GBP',
        configuredRatesJson: '{"GBP":"0.78125"}',
      }),
    ).resolves.toEqual({
      amountMinor: 390n,
      currency: 'GBP',
      rate: '0.78125',
      source: 'configured',
    });
  });

  it('fails closed when no explicit Mkety commercial checkout rate exists', async () => {
    await expect(
      quoteFlutterwaveCollection({
        canonicalAmountMinor: 3999n,
        canonicalCurrency: 'USD',
        collectionCurrency: 'NGN',
        configuredRatesJson: '{}',
      }),
    ).rejects.toThrow('not configured');
  });

  it('exposes only USD plus explicitly priced Mkety collection currencies', () => {
    expect(getEnabledMketyFlutterwaveCurrencies('{"NGN":"1500","KES":"130","BAD":"1"}')).toEqual([
      'USD',
      'NGN',
      'KES',
    ]);
    expect(getEnabledMketyFlutterwaveCurrencies('{}')).toEqual(['USD']);
  });

  it('creates hosted checkout without exposing provider secrets in the payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/v3/hosted/pay/example' },
      }),
    });

    const link = await createFlutterwaveHostedCheckout({
      source: 'saas',
      reference: 'SAAS-MKS-ABC123',
      amountMinor: 3999n,
      currency: 'USD',
      email: 'billing@example.com',
      customerName: 'Example',
      redirectUrl: 'https://mkety.com/return',
      metadata: { source: 'saas' },
      secretKey: 'FLWSECK_TEST-private',
      fetchImpl: fetchMock,
    });

    expect(link).toBe('https://checkout.flutterwave.com/v3/hosted/pay/example');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      tx_ref: 'SAAS-MKS-ABC123',
      amount: '39.99',
      currency: 'USD',
      customer: { email: 'billing@example.com', name: 'Example' },
      meta: { source: 'saas' },
    });
    expect(body.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain('FLWSECK_TEST-private');
  });

  it('re-queries Standard transactions before settlement', async () => {
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
