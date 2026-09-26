/** @jest-environment node */

import {
  buildFlutterwaveInlineConfig,
  createFlutterwaveHostedCheckout,
  createFlutterwavePayloadHash,
  verifyFlutterwaveStandardTransaction,
} from './flutterwave-standard';

describe('Flutterwave v3 payment helpers', () => {
  it('creates the checksum required for Inline/Standard without exposing the secret', async () => {
    const hash = await createFlutterwavePayloadHash({
      amountMinor: 3999n,
      currency: 'USD',
      email: 'billing@example.com',
      reference: 'SAAS-MKS-ABC123',
      secretKey: 'FLWSECK_TEST-private',
    });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('FLWSECK');
  });

  it('builds a client-safe Inline configuration', async () => {
    const config = await buildFlutterwaveInlineConfig({
      publicKey: 'FLWPUBK_TEST-public',
      secretKey: 'FLWSECK_TEST-private',
      source: 'saas',
      reference: 'SAAS-MKS-ABC123',
      amountMinor: 3999n,
      currency: 'USD',
      email: 'billing@example.com',
      customerName: 'Example',
      redirectUrl: 'https://mkety.com/return',
      metadata: { source: 'saas' },
    });

    expect(config).toMatchObject({
      public_key: 'FLWPUBK_TEST-public',
      tx_ref: 'SAAS-MKS-ABC123',
      amount: 39.99,
      currency: 'USD',
      customer: { email: 'billing@example.com', name: 'Example' },
      meta: { source: 'saas' },
    });
    expect(config.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(config)).not.toContain('FLWSECK_TEST-private');
  });

  it('keeps Standard as a same-version hosted fallback', async () => {
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
      redirectUrl: 'https://mkety.com/return',
      metadata: { source: 'saas' },
      secretKey: 'FLWSECK_TEST-private',
      fetchImpl: fetchMock,
    });

    expect(link).toBe('https://checkout.flutterwave.com/v3/hosted/pay/example');
  });

  it('re-queries transactions before settlement', async () => {
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
