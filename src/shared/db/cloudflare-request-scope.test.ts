/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const publicRuntimeFiles = [
  'src/app/api/health/route.ts',
  'src/features/platform-content/server/queries.ts',
  'src/features/platform-content/server/public-page.ts',
  'src/features/platform-content/server/public-page-query.ts',
];

describe('Cloudflare public-site database request lifecycle', () => {
  it('keeps public Worker runtime modules off the global Cloudflare database singleton', async () => {
    const sources = await Promise.all(
      publicRuntimeFiles.map(async (relativePath) => ({
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

  it('uses request-scoped database creation for public-site runtime paths', async () => {
    const sources = await Promise.all(
      publicRuntimeFiles.map((relativePath) => readFile(path.resolve(process.cwd(), relativePath), 'utf8')),
    );

    for (const source of sources) {
      expect(source).toContain('withRequestDatabase');
    }
  });
});
