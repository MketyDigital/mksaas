/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('standalone Platform Control boundary', () => {
  it('routes Mkety Ops outside the tenant admin render tree', async () => {
    const opsEntry = await read('src/app/ops/page.tsx');
    const opsLayout = await read('src/app/ops/[tenant]/layout.tsx');
    const tenantLayout = await read('src/app/(tenant)/t/[tenant]/layout.tsx');

    expect(opsEntry).toContain('redirect(`/ops/${tenant}/platform-control`)');
    expect(opsLayout).toContain('requirePlatformControlAccess(tenant)');
    expect(opsLayout).toContain('withRequestDatabase');
    expect(opsLayout).not.toContain('TenantLayoutClient');
    expect(tenantLayout).toContain('TenantLayoutClient');
  });

  it('normalizes Platform Control mutation redirects to the isolated surface', async () => {
    const mutation = await read('src/shared/db/platform-control-mutation.ts');

    expect(mutation).toContain('standalonePlatformControlPath');
    expect(mutation).toContain('/ops/${match[1]}/platform-control');
    expect(mutation).toContain('standalonePlatformControlPath(input.path)');
  });

  it('points operator navigation at the isolated surface', async () => {
    const navigation = await read('src/shared/components/layout/nav/AdminViewNav.tsx');

    expect(navigation).toContain('/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control');
    expect(navigation).toContain('/platform-control/ai-operations');
    expect(navigation).toContain('/platform-control/payments');
  });

  it('provides an ops-local error boundary', async () => {
    const errorBoundary = await read('src/app/ops/[tenant]/error.tsx');

    expect(errorBoundary).toContain('Standalone Platform Control error');
    expect(errorBoundary).toContain('isolated to Mkety Ops');
    expect(errorBoundary).toContain('Retry module');
  });
});
