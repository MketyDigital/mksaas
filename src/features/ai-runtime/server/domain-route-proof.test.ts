import { probeEnterpriseAiHostnameRoute } from './domain-route-proof';

describe('Enterprise AI live hostname route proof', () => {
  it('accepts only the exact hostname and expected tenant id', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      hostname: 'ai.starpipsforex.com',
      tenant_id: 'tenant-starpips',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(probeEnterpriseAiHostnameRoute(
      'ai.starpipsforex.com',
      'tenant-starpips',
      fetchImpl as typeof fetch,
    )).resolves.toEqual({
      ok: true,
      hostname: 'ai.starpipsforex.com',
      tenantId: 'tenant-starpips',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ai.starpipsforex.com/api/v1/ai/domain-route-proof',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
      }),
    );
  });

  it('rejects cross-tenant route proof even when HTTPS responds successfully', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      hostname: 'ai.starpipsforex.com',
      tenant_id: 'tenant-other',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(probeEnterpriseAiHostnameRoute(
      'ai.starpipsforex.com',
      'tenant-starpips',
      fetchImpl as typeof fetch,
    )).resolves.toEqual({
      ok: false,
      hostname: 'ai.starpipsforex.com',
      tenantId: 'tenant-other',
      reason: 'route_probe_tenant_mismatch',
    });
  });

  it('fails closed on redirects, HTTP failures and network failures', async () => {
    const httpFailure = jest.fn(async () => new Response('bad gateway', { status: 502 }));
    await expect(probeEnterpriseAiHostnameRoute(
      'ai.starpipsforex.com',
      'tenant-starpips',
      httpFailure as typeof fetch,
    )).resolves.toMatchObject({ ok: false, reason: 'route_probe_http_error' });

    const networkFailure = jest.fn(async () => { throw new Error('network unavailable'); });
    await expect(probeEnterpriseAiHostnameRoute(
      'ai.starpipsforex.com',
      'tenant-starpips',
      networkFailure as typeof fetch,
    )).resolves.toMatchObject({ ok: false, reason: 'route_probe_failed' });
  });
});
