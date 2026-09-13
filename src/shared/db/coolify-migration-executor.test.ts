/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Coolify production DB executor', () => {
  it('uses a migration-only dependency manifest instead of the full application install', async () => {
    const dockerfile = await read('ops/coolify-migration/Dockerfile');
    const manifest = JSON.parse(await read('ops/coolify-migration/package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(dockerfile).toContain('ops/coolify-migration/package.json');
    expect(dockerfile).not.toContain('COPY package.json pnpm-lock.yaml');
    expect(dockerfile).not.toContain('pnpm install --frozen-lockfile');
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      ['dotenv', 'drizzle-kit', 'drizzle-orm', 'postgres', 'tsx'].sort(),
    );
  });

  it('is manual/reusable, exact-SHA gated, HTTPS-only, private-networked, always cleaned up, and requires the full migration release marker', async () => {
    const workflow = await read('.github/workflows/mkety-coolify-production-db-executor.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('workflow_call:');
    expect(workflow).not.toContain("push:\n");
    expect(workflow).toContain('required: true');
    expect(workflow).toContain("curl --proto '=https' --tlsv1.2");
    expect(workflow).toContain('connect_to_docker_network:true');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('RELEASE_BRANCH: feat/mkety-public-site-production');
    expect(workflow).toContain('MKETY_DB_RELEASE_SEQUENCE_OK=true');
    expect(workflow).toContain('Migration container became healthy before the full release sequence completed.');
  });
});
