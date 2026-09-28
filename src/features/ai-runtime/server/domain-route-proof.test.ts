import { readFile } from 'node:fs/promises';

import { probeEnterpriseAiHostnameRoute } from './domain-route-proof';

describe('Enterprise AI live hostname route proof', () => {
  it('accepts a working HTTPS route only when it proves the expected tenant', async () => {
    const fetchImpl = async () => Response.json({
      ok: true,
      hostname: 'ai.customer.com',
      tenant_id: 'tenant-1',
    });

    await expect(
      probeEnterpriseAiHostnameRoute(
        'ai.customer.com',
        'tenant-1',
        fetchImpl as typeof fetch,
      ),
    ).resolves.toMatchObject({
      ok: true,
      hostname: 'ai.customer.com',
      tenantId: 'tenant-1',
    });
  });

  it('rejects a live hostname that resolves to another tenant', async () => {
    const fetchImpl = async () => Response.json({
      ok: true,
      hostname: 'ai.customer.com',
      tenant_id: 'tenant-other',
    });

    await expect(
      probeEnterpriseAiHostnameRoute(
        'ai.customer.com',
        'tenant-1',
        fetchImpl as typeof fetch,
      ),
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
