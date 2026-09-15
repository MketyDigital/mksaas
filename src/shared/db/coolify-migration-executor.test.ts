/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

describe('Coolify production DB executor', () => {
  it('uses a migration-only dependency manifest and a non-root runtime instead of the full application install', async () => {
    const dockerfile = await read('ops/coolify-migration/Dockerfile');
    const manifest = JSON.parse(await read('ops/coolify-migration/package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(dockerfile).toContain('ops/coolify-migration/package.json');
    expect(dockerfile).not.toContain('COPY package.json pnpm-lock.yaml');
    expect(dockerfile).not.toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toContain('USER node');
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      ['dotenv', 'drizzle-kit', 'drizzle-orm', 'postgres', 'tsx'].sort(),
    );
  });

  it('is manual/reusable, exact-SHA gated, HTTPS-only, private-networked, resolves the private DB URL from Coolify, always cleans up, and requires the full migration release marker', async () => {
    const workflow = await read('.github/workflows/mkety-coolify-production-db-executor.yml');

    // The reusable executor must derive the private runtime URL itself instead of
    // relying on environment-secret propagation across a workflow_call boundary.
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('workflow_call:');
    expect(workflow).not.toContain("push:\n");
    expect(workflow).toContain('required: true');
    expect(workflow).toContain("curl --proto '=https' --tlsv1.2");
    expect(workflow).toContain('connect_to_docker_network:true');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('RELEASE_BRANCH: feat/mkety-public-site-production');
    expect(workflow).toContain('POSTGRES_UUID: hgxwkiyxgbmb2i3pl57kmxc8');
    expect(workflow).toContain('$cool/databases/$POSTGRES_UUID');
    expect(workflow).toContain('Private PostgreSQL preflight failed');
    expect(workflow).toContain('internal_db_url');
    expect(workflow).toContain('DATABASE_URL=$DATABASE_URL');
    expect(workflow).not.toContain('DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}');
    expect(workflow).not.toContain('PRODUCTION_DATABASE_URL is required.');
    expect(workflow).toContain('MKETY_DB_RELEASE_SEQUENCE_OK=true');
    expect(workflow).toContain('Migration container became healthy before the full release sequence completed.');
  });

  it('captures failed Coolify deployment logs before the ephemeral migration host is deleted', async () => {
    const workflow = await read('.github/workflows/mkety-coolify-production-db-executor.yml');

    expect(workflow).toContain('deployment.logs');
    expect(workflow).toContain('Safe Coolify deployment diagnostic:');
    expect(workflow.indexOf('Safe Coolify deployment diagnostic:')).toBeLessThan(
      workflow.indexOf('Delete ephemeral migration host'),
    );
  });
});
