/** @jest-environment node */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('canonical customer app root', () => {
  it('serves tenant workspaces from /app and keeps Platform Control out of the customer tree', async () => {
    await expect(access(path.join(root, 'src/app/app/[tenant]/layout.tsx'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/app/app/[tenant]/page.tsx'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/app/app/[tenant]/admin/page.tsx'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'src/app/app/[tenant]/admin/platform-control/page.tsx'))).rejects.toThrow();
  });

  it('makes /app the canonical tenant route and permanently redirects legacy /t paths', async () => {
    const proxy = await read('src/proxy.ts');
    const appEntry = await read('src/app/app/page.tsx');

    expect(appEntry).toContain('redirect(`/app/${tenants[0]}`)');
    expect(proxy).toContain("if (pathname.startsWith('/t/'))");
    expect(proxy).toContain("pathname.replace(/^\\/t\\//, '/app/')");
    expect(proxy).toContain('NextResponse.redirect(url, 308)');
    expect(proxy).toContain("effectivePathname.match(/^\\/app\\/([^/]+)/)");
  });

  it('uses canonical app paths in the shared authenticated shell', async () => {
    const sidebar = await read('src/shared/components/layout/UnifiedSidebar.tsx');
    const header = await read('src/shared/components/layout/TopHeader.tsx');
    const switcher = await read('src/shared/components/layout/ViewSwitcher.tsx');
    const userMenu = await read('src/shared/components/layout/SidebarUserMenu.tsx');
    const viewProvider = await read('src/shared/providers/view-provider.tsx');
    const tenant = await read('src/shared/lib/tenant.ts');

    expect(sidebar).toContain('/app/${tenantSlug}');
    expect(header).toContain('/app/${tenantSlug}');
    expect(switcher).toContain('/app/${tenantSlug}');
    expect(userMenu).toContain('/app/${tenantSlug}');
    expect(viewProvider).toContain('/app/${tenantSlug}/admin');
    expect(tenant).toContain('return `/app/${tenantSlug}${cleanPath}`;');
  });

  it('routes custom domains and Enterprise AI hostnames into the canonical app tree', async () => {
    const proxy = await read('src/proxy.ts');

    expect(proxy).toContain('/app/${enterpriseHost.tenant.slug}/login');
    expect(proxy).toContain('/app/${enterpriseHost.tenant.slug}/enterprise-ai/customer');
    expect(proxy).toContain('/app/${tenant.slug}');
  });
});
