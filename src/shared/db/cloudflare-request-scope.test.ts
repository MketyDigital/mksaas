/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const runtimeFiles = [
  'src/app/api/health/route.ts',
  'src/features/platform-content/server/queries.ts',
  'src/features/platform-content/server/public-page.ts',
  'src/features/platform-content/server/public-page-query.ts',
  'src/features/platform-app-experience/server/queries.ts',
  'src/features/enterprise-checkout/server/repository.ts',
  'src/proxy.ts',
  'src/shared/lib/auth/repository.ts',
  'src/shared/lib/auth/service.ts',
  'src/shared/lib/permissions.ts',
  'src/shared/lib/tenant.ts',
];

describe('Cloudflare database request lifecycle', () => {
  it('keeps Worker runtime modules off the global Cloudflare database singleton', async () => {
    const sources = await Promise.all(
      runtimeFiles.map(async (relativePath) => ({
        relativePath,
        source: await readFile(path.resolve(process.cwd(), relativePath), 'utf8'),
      })),
    );

    for (const { relativePath, source } of sources) {
      expect({ relativePath, source }).not.toEqual(
        expect.objectContaining({
          source: expect.stringContaining("@/shared/db/cloudflare"),
        }),
      );
    }
  });

  it('uses request-scoped database creation for public, auth, tenant, and checkout runtime paths', async () => {
    const sources = await Promise.all(
      runtimeFiles
        .filter((relativePath) => !relativePath.endsWith('repository.ts') || relativePath.includes('enterprise-checkout'))
        .map((relativePath) => readFile(path.resolve(process.cwd(), relativePath), 'utf8')),
    );

    for (const source of sources) {
      expect(source).toContain('withRequestDatabase');
    }
  });
});
