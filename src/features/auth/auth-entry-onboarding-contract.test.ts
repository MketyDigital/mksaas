/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Mkety auth entry and self-service onboarding contract', () => {
  it('sends login and signup directly into the branded auth intent without an intermediary click', async () => {
    const [login, signup, header] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
      read('src/features/platform-content/components/public/MketyPublicHeader.tsx'),
    ]);

    expect(login).toContain('/api/auth/login?returnTo=');
    expect(login).toContain('intent=signin');
    expect(signup).toContain('/api/auth/login?returnTo=');
    expect(signup).toContain('intent=signup');
    expect(login).not.toContain('<LoginForm');
    expect(signup).not.toContain('<LoginForm');
    expect(header).toContain('intent=signin');
    expect(header).toContain('intent=signup');
  });

  it('preserves selected plan through signup/sign-in into tenant checkout', async () => {
    const [login, signup, selectTenant, workspaceRoute] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
      read('src/app/(auth)/select-tenant/page.tsx'),
      read('src/app/api/workspaces/route.ts'),
    ]);

    expect(login).toContain('/billing/checkout?${planQuery}');
    expect(signup).toContain('/select-tenant?${planQuery}');
    expect(selectTenant).toContain('/billing/checkout?${planQuery}');
    expect(workspaceRoute).toContain('/billing/checkout?plan=');
  });

  it('preserves selected billing term through auth and workspace onboarding', async () => {
    const [login, signup, selectTenant, createWorkspace, workspaceRoute] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
      read('src/app/(auth)/select-tenant/page.tsx'),
      read('src/app/create-workspace/page.tsx'),
      read('src/app/api/workspaces/route.ts'),
    ]);

    for (const source of [login, signup, selectTenant, createWorkspace]) {
      expect(source).toContain('term');
      expect(source).toContain('isSelfServiceBillingTermKey');
    }
    expect(workspaceRoute).toContain('isSelfServiceBillingTermKey');
    expect(workspaceRoute).toContain('&term=');
  });

  it('uses account and workspace creation before self-service payment', async () => {
    const checkout = await read('src/app/(tenant)/t/[tenant]/billing/checkout/page.tsx');
    const workspaceRoute = await read('src/app/api/workspaces/route.ts');

    expect(workspaceRoute).toContain("role: 'admin'");
    expect(checkout).toContain('if (!session?.user?.id) redirect');
    expect(checkout).toContain('Continue to secure payment');
    expect(checkout).toContain('Access activates only after verified payment settlement');
  });

  it('reserves global Platform Control for the configured operator workspace and allowlisted identities', async () => {
    const [authorization, workspaceRoute] = await Promise.all([
      read('src/features/platform-content/server/authorization.ts'),
      read('src/app/api/workspaces/route.ts'),
    ]);

    expect(authorization).toContain('MKETY_PLATFORM_CONTROL_TENANT_SLUG');
    expect(authorization).toContain('MKETY_PLATFORM_ADMIN_EMAILS');
    expect(authorization).toContain('isPlatformOperatorEmail(actor.email)');
    expect(workspaceRoute).toContain('isPlatformControlTenant(slug)');
    expect(workspaceRoute).toContain('That workspace address is reserved.');
  });
});
