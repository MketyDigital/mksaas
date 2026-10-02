/** @jest-environment node */

import { readFile } from 'node:fs/promises';

import { buildTenantPaymentReturnPath, normalizeTenantPaymentReturnPath } from '@/features/payments/return-path';

describe('Enterprise AI customer payment journey', () => {
  it('shows an existing unpaid Enterprise AI agreement on the workspace dashboard', async () => {
    const dashboard = await readFile('src/app/app/[tenant]/page.tsx', 'utf8');

    expect(dashboard).toContain('getEnterpriseAiContractBillingState(tenant.id)');
    expect(dashboard).toContain('hasEnterpriseAiContract');
    expect(dashboard).toContain('Enterprise AI · Agreement ready');
    expect(dashboard).toContain('/enterprise-ai');
  });

  it('uses the shared complete provider configuration before showing Enterprise AI payment methods', async () => {
    const page = await readFile('src/app/app/[tenant]/enterprise-ai/page.tsx', 'utf8');

    expect(page).toContain('getAvailableMketyPaymentProviders');
    expect(page).toContain('brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET');
    expect(page).toContain('collectionCurrencies: getEnabledMketyFlutterwaveCurrencies');
    expect(page).not.toContain("process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET\n      ? [{ value: 'flutterwave'");
  });

  it('uses the canonical Enterprise AI page as checkout return target', async () => {
    const route = await readFile('src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts', 'utf8');

    expect(route).toContain('buildTenantPaymentReturnPath');
    expect(route).toContain("surface: 'enterprise-ai'");
    expect(route).not.toContain('/t/${encodeURIComponent(tenantSlug)}/enterprise-ai');
    expect(buildTenantPaymentReturnPath({ tenantSlug: 'example', surface: 'enterprise-ai', state: 'returned' }))
      .toBe('/app/example/enterprise-ai?payment=returned');
  });

  it('allows Enterprise AI return paths in embedded payment launchers', async () => {
    const [flutterwave, kora] = await Promise.all([
      readFile('src/app/payments/flutterwave/inline/page.tsx', 'utf8'),
      readFile('src/app/payments/kora/embedded/page.tsx', 'utf8'),
    ]);

    for (const source of [flutterwave, kora]) {
      expect(source).toContain('normalizeTenantPaymentReturnPath');
      expect(source).toContain("String(query.returnPath ?? ''), tenant.slug");
    }
    expect(normalizeTenantPaymentReturnPath('/t/example/enterprise-ai?payment=returned', 'example'))
      .toBe('/app/example/enterprise-ai?payment=returned');
  });
});
