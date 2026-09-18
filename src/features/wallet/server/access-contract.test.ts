/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Wallet security and settlement contracts', () => {
  it('requires explicit tenant membership before reading wallet data', async () => {
    const page = await read('src/app/(tenant)/t/[tenant]/wallet/page.tsx');

    expect(page).toContain("import { requireTenantMembership } from '@/shared/lib/permissions';");
    expect(page).toContain('await requireTenantMembership(tenantSlug);');
    expect(page).not.toContain('await auth();');
  });

  it('shows only applied billing settlements as verified payment records', async () => {
    const source = await read('src/features/wallet/server/drizzle-source.ts');

    expect(source).toContain("eq(billingSettlements.status, 'applied')");
  });
});
