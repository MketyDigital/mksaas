import { readFile } from 'node:fs/promises';

describe('Enterprise AI true white-label and domain contract', () => {
  it('uses one-CNAME Cloudflare for SaaS onboarding with HTTP validation', async () => {
    const source = await readFile('src/features/domains/server/cloudflare-saas.ts', 'utf8');
    expect(source).toContain("method: 'http'");
    expect(source).toContain('MKETY_SAAS_CNAME_TARGET');
    expect(source).toContain("discoverCloudflareZoneId(apiToken, accountId, 'mkety.com')");
    expect(source).toContain("discoverCloudflareZoneId(apiToken, accountId, 'mkety.app')");
    expect(source).toContain('/custom_hostnames/fallback_origin');
    expect(source).toContain('provisionMketyAppManagedHostname');
    expect(source).toContain("type: 'CNAME'");
  });

  it('never treats an unprovisioned mkety.app slug as a live hostname', async () => {
    const source = await readFile('src/features/ai-runtime/server/enterprise-hostnames.ts', 'utf8');
    expect(source).toContain("eq(customDomains.status, 'verified')");
    expect(source).not.toContain('eq(tenants.slug, subdomain)');
    expect(source).toContain("metadata.managed === true");
  });

  it('keeps white-label hosts on the customer app instead of the Mkety management console', async () => {
    const source = await readFile('src/proxy.ts', 'utf8');
    expect(source).toContain('/enterprise-ai/customer');
    expect(source).toContain("loginUrl.searchParams.set('enterpriseAiHost'");
  });

  it('binds one-time product handoffs to the destination hostname', async () => {
    const service = await readFile('src/shared/lib/auth/service.ts', 'utf8');
    const start = await readFile('src/app/api/auth/product-handoff/start/route.ts', 'utf8');
    const consume = await readFile('src/app/api/auth/product-handoff/consume/route.ts', 'utf8');
    expect(service).toContain('productHandoffNonce(product, targetHost)');
    expect(start).toContain("retry.searchParams.set('targetHost', targetHost)");
    expect(consume).toContain('consumeProductHandoff(token, product, handoffHost)');
  });

  it('only hides Mkety branding when the tenant has true white-label access', async () => {
    const page = await readFile(
      'src/app/(tenant)/t/[tenant]/enterprise-ai/customer/page.tsx',
      'utf8',
    );
    expect(page).toContain('hasEnterpriseAiWhiteLabelAccess');
    expect(page).toContain('!brand.hideMketyBranding');
    expect(page).toContain('Powered by Mkety');
  });
});
