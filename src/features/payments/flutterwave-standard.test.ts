/** @jest-environment node */

import {
  createFlutterwaveHostedCheckout,
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
        secretKey: 'secret',
        fetchImpl: jest.fn(),
      }),
    ).resolves.toEqual({ amountMinor: 3999n, currency: 'USD', rate: '1' });
  });

  it('normalizes high-precision FX source amounts to payment precision', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          rate: '0.000707',
          source: { amount: '56562.942008' },
          destination: { amount: '39.99', currency: 'USD' },
        },
      }),
    });

    const quote = await quoteFlutterwaveCollection({
      canonicalAmountMinor: 3999n,
      canonicalCurrency: 'USD',
      collectionCurrency: 'NGN',
      secretKey: 'secret',
      fetchImpl: fetchMock,
    });

    expect(quote).toEqual({ amountMinor: 5656294n, currency: 'NGN', rate: '0.000707' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('destination_currency=USD');
    expect(String(fetchMock.mock.calls[0][0])).toContain('source_currency=NGN');
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
