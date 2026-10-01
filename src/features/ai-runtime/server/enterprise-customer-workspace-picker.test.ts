/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI customer workspace selection', () => {
  it('loads existing customer workspaces and excludes the reserved Ops tenant', async () => {
    const [page, contracts] = await Promise.all([
      readFile('src/app/ops/[tenant]/platform-control/[module]/page.tsx', 'utf8'),
      readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8'),
    ]);

    expect(page).toContain('listEnterpriseAiCustomerWorkspaces(tenant)');
    expect(page).toContain('Select an existing customer workspace');
    expect(page).toContain('value={workspace.slug}');
    expect(contracts).toContain('export async function listEnterpriseAiCustomerWorkspaces');
    expect(contracts).toContain('where(ne(tenants.slug, opsTenantSlug))');
    expect(contracts).toContain('orderBy(asc(tenants.name), asc(tenants.slug))');
  });
});
