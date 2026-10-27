import test from 'node:test';
import assert from 'node:assert/strict';
import { assessConnectorVersion, fetchTunnelAudit } from './cloudflared-security-audit.mjs';

test('assesses the fixed version floor and the macOS install-method exception', () => {
  assert.equal(assessConnectorVersion('2026.10.2', 'linux_amd64'), 'patched');
  assert.equal(assessConnectorVersion('2026.10.1', 'linux_amd64'), 'upgrade_required');
  assert.equal(assessConnectorVersion('2026.10.2', 'darwin_arm64'), 'macos_install_method_review');
  assert.equal(assessConnectorVersion('2026.10.3', 'darwin_arm64'), 'patched');
  assert.equal(assessConnectorVersion('unknown', 'linux_amd64'), 'unknown');
  assert.equal(assessConnectorVersion('2026.10.3-rc.1', 'linux_amd64'), 'unknown');
});

test('paginates tunnels and connections and emits only sanitized version data', async () => {
  const accountId = 'a'.repeat(32);
  const apiToken = 'secret-token';
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    const parsed = new URL(url);
    const path = parsed.pathname;
    const page = Number(parsed.searchParams.get('page') || 1);
    let result;
    let totalPages = 1;

    if (path.endsWith('/cfd_tunnel')) {
      totalPages = 2;
      result = page === 1
        ? [{ id: '11111111-1111-4111-8111-111111111111', name: 'prod-linux', status: 'healthy' }]
        : [{ id: '22222222-2222-4222-8222-222222222222', name: 'mac-connector', status: 'healthy' }];
    } else if (path.endsWith('/11111111-1111-4111-8111-111111111111/connections')) {
      totalPages = 2;
      result = page === 1
        ? [{ arch: 'linux_amd64', version: '2026.10.2', conns: [{ client_version: '2026.10.2', origin_ip: '192.0.2.1' }] }]
        : [{ arch: 'linux_amd64', version: '2026.10.2', conns: [{ client_version: '2026.10.2', origin_ip: '192.0.2.2' }] }];
    } else if (path.endsWith('/22222222-2222-4222-8222-222222222222/connections')) {
      result = [{ arch: 'darwin_arm64', version: '2026.10.2', conns: [{ client_version: '2026.10.2', origin_ip: '192.0.2.3' }] }];
    } else {
      throw new Error(`Unexpected endpoint ${path}`);
    }

    return new Response(JSON.stringify({ success: true, result, result_info: { total_pages: totalPages } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await fetchTunnelAudit({ accountId, apiToken, fetcher });

  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ options }) => options.method === 'GET'));
  assert.ok(calls.every(({ options }) => options.headers.Authorization === `Bearer ${apiToken}`));
  assert.deepEqual(result.map(({ name, assessment, connectorCount, connectionCount }) => ({
    name, assessment, connectorCount, connectionCount,
  })), [
    { name: 'prod-linux', assessment: 'patched', connectorCount: 2, connectionCount: 2 },
    { name: 'mac-connector', assessment: 'macos_install_method_review', connectorCount: 1, connectionCount: 1 },
  ]);

  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /11111111|22222222|192\.0\.2\.|secret-token|origin_ip/i);
});

test('reports tunnels with no active connections without claiming a host is patched', async () => {
  const fetcher = async (url) => {
    const parsed = new URL(url);
    const result = parsed.pathname.endsWith('/cfd_tunnel')
      ? [{ id: '33333333-3333-4333-8333-333333333333', name: 'offline', status: 'inactive' }]
      : [];
    return new Response(JSON.stringify({ success: true, result, result_info: { total_pages: 1 } }), { status: 200 });
  };

  const result = await fetchTunnelAudit({ accountId: 'a'.repeat(32), apiToken: 'token', fetcher });
  assert.equal(result[0].assessment, 'no_active_connectors');
  assert.equal(result[0].connectorCount, 0);
  assert.equal(result[0].connectionCount, 0);
});

test('continues pagination when a full page has a null total-pages value', async () => {
  let tunnelPageCalls = 0;
  let connectionCalls = 0;
  const fetcher = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/cfd_tunnel')) {
      tunnelPageCalls += 1;
      const page = Number(parsed.searchParams.get('page'));
      const result = page === 1
        ? Array.from({ length: 100 }, (_, index) => ({
            id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            name: `tunnel-${index + 1}`,
            status: 'inactive',
          }))
        : [];
      return new Response(JSON.stringify({ success: true, result, result_info: { total_pages: null } }), { status: 200 });
    }

    connectionCalls += 1;
    return new Response(JSON.stringify({ success: true, result: [], result_info: { total_pages: null } }), { status: 200 });
  };

  const result = await fetchTunnelAudit({ accountId: 'a'.repeat(32), apiToken: 'token', fetcher });
  assert.equal(tunnelPageCalls, 2);
  assert.equal(connectionCalls, 100);
  assert.equal(result.length, 100);
});

test('does not expose a raw Cloudflare API error body', async () => {
  const fetcher = async () => new Response('raw secret=do-not-print', { status: 403 });

  await assert.rejects(
    fetchTunnelAudit({ accountId: 'a'.repeat(32), apiToken: 'token', fetcher }),
    (error) => {
      assert.equal(error.message, 'Cloudflare API request failed (403)');
      assert.doesNotMatch(error.message, /do-not-print|secret=/);
      return true;
    },
  );
});
