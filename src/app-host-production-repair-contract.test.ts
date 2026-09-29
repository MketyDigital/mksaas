/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW = path.resolve(process.cwd(), '.github/workflows/mkety-app-host-production-repair.yml');

describe('app.mkety.com production repair workflow contract', () => {
  it('is manual-only, exact-SHA pinned, and isolated to the dedicated app Worker', async () => {
    const source = await readFile(WORKFLOW, 'utf8');

    expect(source).toContain('workflow_dispatch:');
    expect(source).not.toContain('pull_request:');
    expect(source).not.toContain('push:');
    expect(source).toContain('REPAIR APP.MKETY.COM');
    expect(source).toContain('APP_WORKER_NAME: mkety-app-host');
    expect(source).toContain('RELEASE_BRANCH: main');
    expect(source).toContain('verified_sha');
    expect(source).toContain('git ls-remote origin "refs/heads/$RELEASE_BRANCH"');
    expect(source).toContain('Verify SHA matches current main');
  });

  it('uses the existing production Hyperdrive and app-specific auth origin', async () => {
    const source = await readFile(WORKFLOW, 'utf8');

    expect(source).toContain('MKETY_HYPERDRIVE_NAME: mkety-production-db-v2');
    expect(source).toContain("config.hyperdrive=[{binding:'MKETY_DB'");
    expect(source).toContain('MKETY_AUTH_REDIRECT_URI: https://app.mkety.com/api/auth/callback');
    expect(source).toContain('MKETY_AUTH_POST_LOGOUT_REDIRECT_URI: https://app.mkety.com/login');
    expect(source).toContain('NEXT_PUBLIC_APP_URL: https://app.mkety.com');
    expect(source).toContain('ZITADEL_APPLICATION_NAME: Mkety Platform Production');
  });

  it('backs up and restores only app.mkety.com DNS/custom-domain state on failure', async () => {
    const source = await readFile(WORKFLOW, 'utf8');

    expect(source).toContain('dns_records?name=app.mkety.com');
    expect(source).toContain("hostname:'app.mkety.com'");
    expect(source).toContain('restore()');
    expect(source).toContain('app-dns-before.json');
    expect(source).toContain('app-domains-before.json');
    expect(source).not.toContain("hostname:'mkety.com'");
    expect(source).not.toContain("hostname:'www.mkety.com'");
  });

  it('verifies root, app login and branded auth before disabling preview exposure', async () => {
    const source = await readFile(WORKFLOW, 'utf8');

    expect(source).toContain("'https://app.mkety.com/'");
    expect(source).toContain("'https://app.mkety.com/app'");
    expect(source).toContain("'https://app.mkety.com/api/auth/login?returnTo=/app&intent=signin'");
    expect(source).toContain("u.origin!=='https://auth.mkety.com'");
    expect(source).toContain('workers_dev":false');
    expect(source).toContain('preview_urls":false');
  });
});
