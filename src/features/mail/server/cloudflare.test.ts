import { findCloudflareZone } from './cloudflare';

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
