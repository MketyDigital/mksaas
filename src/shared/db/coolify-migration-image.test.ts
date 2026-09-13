/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DOCKERFILE_PATH = path.resolve(process.cwd(), 'ops/coolify-migration/Dockerfile');
const RUNNER_PATH = path.resolve(process.cwd(), 'ops/coolify-migration/run.sh');

describe('Coolify production database migration image', () => {
  it('installs only production app dependencies and runs pinned migration CLIs', async () => {
    const [dockerfile, runner] = await Promise.all([
      readFile(DOCKERFILE_PATH, 'utf8'),
      readFile(RUNNER_PATH, 'utf8'),
    ]);

    expect(dockerfile).toContain('pnpm install --prod --frozen-lockfile');
    expect(dockerfile).not.toContain('pnpm install --frozen-lockfile\n');
    expect(runner).toContain('pnpm dlx drizzle-kit@0.31.8 migrate');
    expect(runner).toContain('pnpm dlx tsx@4.21.0 scripts/migrate-mkety-platform-content.ts');
    expect(runner).toContain('pnpm dlx tsx@4.21.0 scripts/seed-mkety-platform-content.ts');
    expect(runner).toContain('pnpm dlx tsx@4.21.0 scripts/smoke-mkety-platform-content.ts');
  });
});
