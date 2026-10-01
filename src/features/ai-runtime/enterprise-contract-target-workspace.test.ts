/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI contract target workspace resolution', () => {
  it('submits and resolves the immutable tenant id for new contracts', async () => {
    const [page, contracts] = await Promise.all([
      readFile('src/app/ops/[tenant]/platform-control/[module]/page.tsx', 'utf8'),
      readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8'),
    ]);

    expect(page).toContain('name="targetTenantId"');
    expect(page).toContain('value={workspace.id}');
    expect(contracts).toContain("formData.get('targetTenantId')");
    expect(contracts).toContain('eq(tenants.id, targetTenantId)');
    expect(contracts).not.toContain("import { getTenantBySlug } from '@/shared/lib/tenant';");
  });

  it('keeps slug fallback for older submitted forms and rejects targeting Mkety Ops itself', async () => {
    const contracts = await readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8');

    expect(contracts).toContain("formData.get('targetTenantSlug')");
    expect(contracts).toContain('eq(tenants.slug, targetTenantSlug)');
    expect(contracts).toContain('target.slug === opsTenantSlug');
  });
});
