import { CloudflareDispatchApiTransport } from './cloudflare-dispatch-api';

const accountId = '1234567890abcdef1234567890abcdef';
const artifact = {
  mainModule: 'index.js',
  compatibilityDate: '2026-10-23',
  modules: [{ name: 'index.js', source: 'export default {}', contentType: 'application/javascript+module' as const }],
};

class TestHeaders {
  values = new Map<string, string>();
  constructor(values?: HeadersInit) {
    if (values && Symbol.iterator in Object(values)) {
      for (const [key, value] of values as [string, string][]) this.set(key, value);
    }
  }
  set(key: string, value: string) { this.values.set(key.toLowerCase(), value); }
  get(key: string) { return this.values.get(key.toLowerCase()) ?? null; }
}

class TestFormData {
  values = new Map<string, unknown>();
  set(name: string, value: unknown) { this.values.set(name, value); }
  get(name: string) { return this.values.get(name) ?? null; }
}

const savedHeaders = global.Headers;
const savedFormData = global.FormData;
beforeAll(() => {
  global.Headers = TestHeaders as unknown as typeof Headers;
  global.FormData = TestFormData as unknown as typeof FormData;
});
afterAll(() => {
  global.Headers = savedHeaders;
  global.FormData = savedFormData;
});

function okResponse(result: unknown) {
  return { ok: true, json: async () => ({ success: true, result }) };
}

describe('Cloudflare Workers for Platforms API transport', () => {
  it('verifies the configured namespace and uploads into its script collection', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(okResponse({ namespace_name: 'mkety-customer-apps' }))
      .mockResolvedValueOnce(okResponse({ id: 'mkety-app-12345678901234567890' }));
    const api = new CloudflareDispatchApiTransport({ accountId, apiToken: 'secret', namespace: 'mkety-customer-apps', fetcher });

    await api.verifyNamespace();
    await api.uploadWorker({ scriptName: 'mkety-app-12345678901234567890', artifact });

    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/mkety-customer-apps`);
    expect(fetcher.mock.calls[1]?.[0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/mkety-customer-apps/scripts/mkety-app-12345678901234567890`);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' });
    expect((fetcher.mock.calls[1]?.[1]?.headers as TestHeaders).get('authorization')).toBe('Bearer secret');
    const form = fetcher.mock.calls[1]?.[1]?.body as FormData;
    expect((form as unknown as TestFormData).get('index.js')).toBeTruthy();
  });

  it('rejects malformed identifiers and reports a missing namespace without exposing provider details', async () => {
    expect(() => new CloudflareDispatchApiTransport({ accountId: 'bad', apiToken: 'secret', namespace: 'mkety-customer-apps' })).toThrow(/account id is invalid/);
    const fetcher = jest.fn().mockResolvedValue(okResponse({ namespace_name: 'another-namespace' }));
    const api = new CloudflareDispatchApiTransport({ accountId, apiToken: 'secret', namespace: 'mkety-customer-apps', fetcher });
    await expect(api.verifyNamespace()).rejects.toThrow(/namespace is unavailable/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
