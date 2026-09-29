import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function route(path: string) {
  return resolve(process.cwd(), 'src/app/(tenant)/t/[tenant]', path);
}

describe('Platform navigation route contract', () => {
  it('keeps every Admin sidebar destination backed by a real route', () => {
    const expected = [
      'admin/page.tsx',
      'admin/platform-control/page.tsx',
      'admin/platform-control/[module]/page.tsx',
      'admin/analytics/page.tsx',
      'admin/members/page.tsx',
      'admin/invites/page.tsx',
      'admin/departments/page.tsx',
      'admin/settings/page.tsx',
      'admin/settings/features/page.tsx',
      'admin/settings/branding/page.tsx',
      'admin/settings/ai-provider/page.tsx',
      'admin/settings/storage/page.tsx',
      'admin/roles/page.tsx',
      'admin/integrations/page.tsx',
      'admin/audit-logs/page.tsx',
    ];
    for (const candidate of expected) {
      expect(existsSync(route(candidate))).toBe(true);
    }
  });

  it('keeps product-operations modules discoverable from the Admin sidebar', () => {
    const nav = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/nav/AdminViewNav.tsx'), 'utf8');
    for (const destination of [
      '/platform-control/ai-operations',
      '/platform-control/mail',
      '/platform-control/media',
      '/platform-control/billing',
      '/platform-control/payments',
      '/platform-control/domains-routing',
    ]) {
      expect(nav).toContain(destination);
    }
  });

  it('keeps tenant product navigation simple and product-aware', () => {
    const nav = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/nav/MyViewNav.tsx'), 'utf8');
    expect(nav).toContain('title="Workspace"');
    expect(nav).toContain('title="Products"');
    expect(nav).toContain('title="Account"');
    expect(nav).toContain('`${basePath}/media`');
    expect(nav).toContain('hasEnterpriseAiAccess');
    expect(nav).toContain('hasMailAccess');
  });

  it('keeps Mkety Mail shell destinations backed by customer routes', () => {
    const expected = [
      'mail/page.tsx',
      'mail/inbox/page.tsx',
      'mail/shared/page.tsx',
      'mail/domains/page.tsx',
      'mail/mailboxes/page.tsx',
      'mail/contacts/page.tsx',
      'mail/templates/page.tsx',
      'mail/customer-updates/page.tsx',
      'mail/developer/page.tsx',
      'mail/analytics/page.tsx',
      'mail/apps/page.tsx',
      'mail/migration/page.tsx',
      'mail/automation/page.tsx',
    ];
    for (const candidate of expected) {
      expect(existsSync(route(candidate))).toBe(true);
    }
  });

  it('keeps primary tenant product routes available', () => {
    for (const candidate of [
      'page.tsx',
      'projects/page.tsx',
      'wallet/page.tsx',
      'billing/page.tsx',
      'billing/checkout/page.tsx',
      'enterprise-ai/page.tsx',
      'enterprise-ai/playground/page.tsx',
      'enterprise-ai/runs/page.tsx',
      'enterprise-ai/conversations/page.tsx',
      'enterprise-ai/reminders/page.tsx',
      'media/page.tsx',
    ]) {
      expect(existsSync(route(candidate))).toBe(true);
    }
  });

  it('keeps api.mkety.com as the canonical versioned API boundary', () => {
    const proxy = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    expect(proxy).toContain("hostname.toLowerCase()===apiHost && pathname.startsWith('/v1/')");
    expect(proxy).toContain("url.pathname='/api'+pathname");
    expect(existsSync(resolve(process.cwd(), 'src/app/api/v1/ai/chat/completions/route.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/app/api/v1/mail/send/route.ts'))).toBe(true);
  });

  it('keeps product hosts on their canonical auth handoff entries', () => {
    const proxy = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    expect(proxy).toContain("url.searchParams.set('product','mail')");
    expect(proxy).toContain("url.searchParams.set('returnTo','/mail/app')");
    expect(proxy).toContain("url.searchParams.set('product','ai')");
    expect(proxy).toContain("url.searchParams.set('returnTo','/ai/app')");
  });
});
