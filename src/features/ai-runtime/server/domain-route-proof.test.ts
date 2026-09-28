import { readFile } from 'node:fs/promises';

import { probeEnterpriseAiHostnameRoute } from './domain-route-proof';

describe('Enterprise AI live hostname route proof', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('accepts a working HTTPS route only when it proves the expected tenant', async () => {
    global.fetch = jest.fn(async () => Response.json({
      ok: true,
      hostname: 'ai.customer.com',
      tenant_id: 'tenant-1',
    })) as typeof fetch;

    await expect(
      probeEnterpriseAiHostnameRoute('ai.customer.com', 'tenant-1'),
    ).resolves.toMatchObject({
      ok: true,
      hostname: 'ai.customer.com',
      tenantId: 'tenant-1',
    });
  });

  it('rejects a live hostname that resolves to another tenant', async () => {
    global.fetch = jest.fn(async () => Response.json({
      ok: true,
      hostname: 'ai.customer.com',
      tenant_id: 'tenant-other',
    })) as typeof fetch;

    await expect(
      probeEnterpriseAiHostnameRoute('ai.customer.com', 'tenant-1'),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'route_probe_tenant_mismatch',
    });
  });

  it('keeps the provider status fallback tied to live-route proof in the admin action', async () => {
    const source = await readFile(
      'src/features/ai-runtime/server/enterprise-admin-actions.ts',
      'utf8',
    );
    expect(source).toContain('strictProviderVerified');
    expect(source).toContain('probeEnterpriseAiHostnameRoute(domain.hostname, tenant.id)');
    expect(source).toContain("verificationMethod = strictProviderVerified");
    expect(source).toContain("'live_route'");
  });
});
