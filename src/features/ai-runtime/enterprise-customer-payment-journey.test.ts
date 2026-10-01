/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI customer payment journey', () => {
  it('shows an existing unpaid Enterprise AI agreement on the workspace dashboard', async () => {
    const dashboard = await readFile('src/app/app/[tenant]/page.tsx', 'utf8');

    expect(dashboard).toContain('getEnterpriseAiContractBillingState(tenant.id)');
    expect(dashboard).toContain('hasEnterpriseAiContract');
    expect(dashboard).toContain('Enterprise AI · Agreement ready');
    expect(dashboard).toContain('/enterprise-ai');
  });

  it('uses the canonical Enterprise AI page as checkout return target', async () => {
    const route = await readFile('src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts', 'utf8');

    expect(route).toContain('/app/${encodeURIComponent(tenantSlug)}/enterprise-ai');
    expect(route).not.toContain('/t/${encodeURIComponent(tenantSlug)}/enterprise-ai');
  });

  it('allows Enterprise AI return paths in embedded payment launchers', async () => {
    const [flutterwave, kora] = await Promise.all([
      readFile('src/app/payments/flutterwave/inline/page.tsx', 'utf8'),
      readFile('src/app/payments/kora/embedded/page.tsx', 'utf8'),
    ]);

    for (const source of [flutterwave, kora]) {
      expect(source).toContain('/app/${tenantSlug}/enterprise-ai');
      expect(source).toContain('allowedPaths');
    }
  });
});
