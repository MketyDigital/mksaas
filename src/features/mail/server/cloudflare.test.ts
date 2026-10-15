import { ensureCloudflareEmailSendingDns, findCloudflareZone } from './cloudflare';

describe('Mail Cloudflare runtime credentials', () => {
  const originalFetch = global.fetch;
  const originalMailToken = process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN;
  const originalDeployToken = process.env.CLOUDFLARE_API_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalMailToken === undefined) delete process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN;
    else process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN = originalMailToken;
    if (originalDeployToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = originalDeployToken;
  });

  it('uses the dedicated Mail token for runtime Cloudflare requests', async () => {
    process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN = 'mail-scoped-token';
    process.env.CLOUDFLARE_API_TOKEN = 'deployment-token';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [{ id: 'zone-1', name: 'mkety.com' }] }),
    });
    global.fetch = mockFetch as typeof fetch;

    await expect(findCloudflareZone('mkety.com')).resolves.toEqual({ id: 'zone-1', name: 'mkety.com' });
    expect(new Headers(mockFetch.mock.calls[0][1]?.headers).get('authorization')).toBe('Bearer mail-scoped-token');
  });

  it('fails closed when only the broad deploy token is configured', async () => {
    delete process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_API_TOKEN = 'deployment-token';
    const mockFetch = jest.fn();
    global.fetch = mockFetch as typeof fetch;

    await expect(findCloudflareZone('mkety.com')).rejects.toThrow('Cloudflare mail automation is not configured.');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Cloudflare Email Sending DNS provisioning', () => {
  const originalFetch = global.fetch;
  const originalMailToken = process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN;

  beforeEach(() => {
    process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN = 'mail-scoped-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalMailToken === undefined) delete process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN;
    else process.env.MKETY_MAIL_CLOUDFLARE_API_TOKEN = originalMailToken;
  });

  it('creates only Cloudflare bounce and DKIM records, leaving apex MX and DMARC untouched', async () => {
    const expected = [
      { type: 'MX', name: 'cf-bounce.mkety.com', content: 'route1.mx.cloudflare.net', priority: 12 },
      { type: 'TXT', name: 'cf-bounce.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
      { type: 'TXT', name: 'cf-bounce._domainkey.mkety.com', content: 'v=DKIM1; k=rsa; p=public-key' },
      { type: 'TXT', name: '_dmarc.mkety.com', content: 'v=DMARC1; p=none' },
      { type: 'MX', name: 'mkety.com', content: 'mx.zoho.com', priority: 10 },
    ];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes('/dns_records?')) {
        return { ok: true, json: async () => ({ success: true, result: expected.slice(3) }) } as Response;
      }
      return { ok: true, json: async () => ({ success: true, result: { id: 'created' } }) } as Response;
    }) as typeof fetch;

    await ensureCloudflareEmailSendingDns('zone-id', 'mkety.com', expected);

    const mutations = calls.filter((call) => call.init?.method === 'POST');
    expect(mutations).toHaveLength(3);
    const bodies = mutations.map((call) => JSON.parse(String(call.init?.body)));
    expect(bodies.map((body) => `${body.type}:${body.name}`).sort()).toEqual([
      'MX:cf-bounce.mkety.com',
      'TXT:cf-bounce._domainkey.mkety.com',
      'TXT:cf-bounce.mkety.com',
    ]);
    expect(bodies.some((body) => body.name === 'mkety.com')).toBe(false);
  });

  it('does not duplicate already matching Cloudflare records', async () => {
    const expected = [
      { type: 'TXT', name: 'cf-bounce.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
      { type: 'TXT', name: 'cf-bounce._domainkey.mkety.com', content: 'v=DKIM1; k=rsa; p=public-key' },
    ];
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, result: expected }) }) as unknown as Response) as typeof fetch;

    await ensureCloudflareEmailSendingDns('zone-id', 'mkety.com', expected);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'POST' }));
  });

  it('fails closed rather than replacing a conflicting SPF record', async () => {
    const expected = [{ type: 'TXT', name: 'cf-bounce.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' }];
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, result: [{ ...expected[0], content: 'v=spf1 include:other.example ~all' }] }),
    }) as unknown as Response) as typeof fetch;

    await expect(ensureCloudflareEmailSendingDns('zone-id', 'mkety.com', expected)).rejects.toThrow('mail_sending_dns_conflict');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves unrelated TXT records at the bounce name while adding its SPF policy', async () => {
    const expected = [{ type: 'TXT', name: 'cf-bounce.mkety.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' }];
    const calls: Array<{ init?: RequestInit }> = [];
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ init });
      return {
        ok: true,
        json: async () => ({ success: true, result: [{ type: 'TXT', name: 'cf-bounce.mkety.com', content: 'provider-verification=abc' }] }),
      } as unknown as Response;
    }) as typeof fetch;

    await ensureCloudflareEmailSendingDns('zone-id', 'mkety.com', expected);

    expect(calls).toHaveLength(2);
    expect(calls[1].init?.method).toBe('POST');
  });

  it('rejects provider records outside the requested domain', async () => {
    global.fetch = jest.fn() as typeof fetch;

    await expect(ensureCloudflareEmailSendingDns('zone-id', 'mkety.com', [
      { type: 'TXT', name: 'cf-bounce.attacker.example', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
    ])).rejects.toThrow('mail_sending_dns_out_of_scope');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
