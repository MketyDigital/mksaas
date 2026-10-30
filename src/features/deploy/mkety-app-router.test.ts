/** @jest-environment node */

import appRouter from '../../../workers/mkety-app-router/src/index';

describe('Mkety app customer dispatch router', () => {
  const workerResponse = new Response('customer app');
  const dispatchedFetch = jest.fn().mockResolvedValue(workerResponse);
  const dispatcher = { get: jest.fn(() => ({ fetch: dispatchedFetch })) };
  const env = {
    DISPATCHER: dispatcher,
    MKETY_DEPLOYMENT_LOOKUP_URL: 'https://api.mkety.com/api/internal/deploy/resolve-hostname',
    MKETY_DEPLOYMENT_LOOKUP_SECRET: 'x'.repeat(40),
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    dispatcher.get.mockClear();
    dispatchedFetch.mockClear();
    global.fetch = jest.fn();
  });

  afterAll(() => { global.fetch = originalFetch; });

  it('serves the branded apex page without dispatching a customer Worker', async () => {
    const response = await appRouter.fetch(new Request('https://mkety.app/'), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('Mkety Platform');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(dispatcher.get).not.toHaveBeenCalled();
  });

  it('dispatches only the active database-resolved provider Worker and preserves the request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(Response.json({ ok: true, deployment: {
      deploymentId: 'd1', tenantId: 't1', kind: 'preview', providerDeploymentRef: 'customer-app-9f81b2',
    } }));
    const request = new Request('https://demo.mkety.app/path?x=1', { headers: { 'x-customer': 'kept' } });
    const response = await appRouter.fetch(request, env);

    expect(response).toBe(workerResponse);
    expect(dispatcher.get).toHaveBeenCalledWith('customer-app-9f81b2');
    expect(dispatchedFetch).toHaveBeenCalledWith(request);
    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MKETY_DEPLOYMENT_LOOKUP_SECRET}`,
        'x-mkety-customer-host': 'demo.mkety.app',
      },
    });
  });

  it('fails closed for unknown hosts, inactive deployments, and unsafe script names', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ ok: false }, { status: 404 }));
    const unknown = await appRouter.fetch(new Request('https://unknown.mkety.app/'), env);
    expect(unknown.status).toBe(404);

    (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ ok: true, deployment: {
      deploymentId: 'd1', tenantId: 't1', kind: 'preview', providerDeploymentRef: '../other-customer',
    } }));
    const unsafe = await appRouter.fetch(new Request('https://owned.mkety.app/'), env);
    expect(unsafe.status).toBe(404);
    expect(dispatcher.get).not.toHaveBeenCalled();
  });
});
