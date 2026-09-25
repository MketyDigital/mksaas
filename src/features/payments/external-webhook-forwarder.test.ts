/** @jest-environment node */

import { forwardOriginalProviderWebhook } from './external-webhook-forwarder';

describe('forwardOriginalProviderWebhook', () => {
  const previousFetch = global.fetch;
  const previousFlutterwaveUrl = process.env.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL;

  afterEach(() => {
    global.fetch = previousFetch;
    process.env.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL = previousFlutterwaveUrl;
  });

  it('forwards the unchanged Flutterwave body and signature to Media', async () => {
    process.env.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL =
      'https://media.mkety.com/api/billing/flutterwave/webhook';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as typeof fetch;
    const rawBody = '{"id":"evt-1","type":"charge.completed"}';

    await expect(
      forwardOriginalProviderWebhook({
        source: 'media',
        provider: 'flutterwave',
        rawBody,
        signature: 'original-signature',
        contentType: 'application/json',
      }),
    ).resolves.toEqual({
      forwarded: true,
      destination: 'https://media.mkety.com/api/billing/flutterwave/webhook',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://media.mkety.com/api/billing/flutterwave/webhook',
      expect.objectContaining({
        method: 'POST',
        body: rawBody,
        headers: expect.objectContaining({
          'flutterwave-signature': 'original-signature',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });


  it('preserves the v3 verif-hash header when requested', async () => {
    process.env.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL =
      'https://media.mkety.com/api/billing/flutterwave/webhook';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as typeof fetch;

    await forwardOriginalProviderWebhook({
      source: 'media',
      provider: 'flutterwave',
      rawBody: '{"event":"charge.completed"}',
      signature: 'legacy-secret-hash',
      signatureHeader: 'verif-hash',
      contentType: 'application/json',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://media.mkety.com/api/billing/flutterwave/webhook',
      expect.objectContaining({
        headers: expect.objectContaining({
          'verif-hash': 'legacy-secret-hash',
        }),
      }),
    );
  });

  it('never accepts an HTTP forwarding destination', async () => {
    process.env.MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL = 'http://media.mkety.com/webhook';

    await expect(
      forwardOriginalProviderWebhook({
        source: 'media',
        provider: 'flutterwave',
        rawBody: '{}',
        signature: 'sig',
      }),
    ).rejects.toThrow('HTTPS');
  });
});
