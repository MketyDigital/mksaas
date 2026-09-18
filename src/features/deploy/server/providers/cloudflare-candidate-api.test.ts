/** @jest-environment node */

import { CloudflareCandidateApiTransport } from './cloudflare-candidate-api';

function ok<T>(result: T) {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Cloudflare candidate API transport', () => {
  it('uploads a module Worker with compatibility date and no bindings', async () => {
    const fetcher = jest.fn().mockResolvedValue(ok({ id: 'mkety-deploy-candidate-1' }));
    const api = new CloudflareCandidateApiTransport({
      accountId: 'account-1',
      apiToken: 'token-secret',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await api.uploadWorker({
      scriptName: 'mkety-deploy-candidate-1',
      artifact: {
        mainModule: 'index.js',
        compatibilityDate: '2026-09-18',
        modules: [
          {
            name: 'index.js',
            source: 'export default { fetch() { return new Response("ok"); } };',
          },
        ],
      },
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account-1/workers/scripts/mkety-deploy-candidate-1',
    );
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-secret');

    const form = init.body as FormData;
    const metadata = form.get('metadata');
    expect(metadata).toBeInstanceOf(Blob);
    const parsed = JSON.parse(await (metadata as Blob).text());
    expect(parsed).toEqual(
      expect.objectContaining({
        main_module: 'index.js',
        compatibility_date: '2026-09-18',
        bindings: [],
      }),
    );
    expect(form.get('index.js')).toBeInstanceOf(Blob);
  });

  it('enables workers.dev but keeps preview URLs disabled', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      ok({ enabled: true, previews_enabled: false }),
    );
    const api = new CloudflareCandidateApiTransport({
      accountId: 'account-1',
      apiToken: 'token-secret',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await api.enableWorkersDev('mkety-deploy-candidate-1');

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      '/workers/scripts/mkety-deploy-candidate-1/subdomain',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      enabled: true,
      previews_enabled: false,
    });
  });

  it('derives the deterministic workers.dev URL from the account subdomain', async () => {
    const fetcher = jest.fn().mockResolvedValue(ok({ subdomain: 'dry-glitter-7e16' }));
    const api = new CloudflareCandidateApiTransport({
      accountId: 'account-1',
      apiToken: 'token-secret',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(
      api.getWorkersDevUrl('mkety-deploy-candidate-1'),
    ).resolves.toBe(
      'https://mkety-deploy-candidate-1.dry-glitter-7e16.workers.dev',
    );
  });

  it('deletes only the named candidate Worker', async () => {
    const fetcher = jest.fn().mockResolvedValue(ok(null));
    const api = new CloudflareCandidateApiTransport({
      accountId: 'account-1',
      apiToken: 'token-secret',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await api.deleteWorker('mkety-deploy-candidate-1');

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      '/workers/scripts/mkety-deploy-candidate-1',
    );
    expect(init.method).toBe('DELETE');
  });

  it('sanitizes Cloudflare API failures without exposing provider details or token', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: 'secret-token leaked provider detail' }],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const api = new CloudflareCandidateApiTransport({
      accountId: 'account-1',
      apiToken: 'token-secret',
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(
      api.getWorkersDevUrl('mkety-deploy-candidate-1'),
    ).rejects.toThrow('Cloudflare candidate API request failed.');

    await expect(
      api.getWorkersDevUrl('mkety-deploy-candidate-1'),
    ).rejects.not.toThrow(/secret-token|provider detail|token-secret/);
  });
});
