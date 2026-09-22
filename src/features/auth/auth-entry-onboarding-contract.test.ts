/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Mkety auth entry and self-service onboarding contract', () => {
  it('keeps login and signup presentation concise', async () => {
    const [login, signup, form] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
      read('src/features/auth/components/LoginForm.tsx'),
    ]);

    expect(login).toContain('Access your Mkety workspace.');
    expect(signup).toContain('Create your account to get started.');
    expect(form).not.toContain('Your account is protected by Mkety');
    expect(form).not.toContain('Create your account securely and continue');
  });

  it('preserves selected plan through signup/sign-in into tenant checkout', async () => {
    const [login, signup, selectTenant, workspaceRoute] = await Promise.all([
      read('src/app/(auth)/login/page.tsx'),
      read('src/app/(auth)/signup/page.tsx'),
      read('src/app/(auth)/select-tenant/page.tsx'),
      read('src/app/api/workspaces/route.ts'),
    ]);

    expect(login).toContain('/billing/checkout?plan=');
    expect(signup).toContain('/select-tenant?plan=');
    expect(selectTenant).toContain('/billing/checkout?plan=');
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
