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
      expect(existsSync(route(candidate)), candidate).toBe(true);
    }
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
      'mail/automation/page.tsx',
    ];
    for (const candidate of expected) {
      expect(existsSync(route(candidate)), candidate).toBe(true);
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
    ]) {
      expect(existsSync(route(candidate)), candidate).toBe(true);
    }
  });

  it('keeps product hosts on their canonical auth handoff entries', () => {
    const proxy = readFileSync(resolve(process.cwd(), 'src/proxy.ts'), 'utf8');
    expect(proxy).toContain("url.searchParams.set('product','mail')");
    expect(proxy).toContain("url.searchParams.set('returnTo','/mail/app')");
    expect(proxy).toContain("url.searchParams.set('product','ai')");
    expect(proxy).toContain("url.searchParams.set('returnTo','/ai/app')");
  });
});
