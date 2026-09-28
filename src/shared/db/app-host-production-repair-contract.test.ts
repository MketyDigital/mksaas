/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-app-host-production-repair.yml',
);

describe('app.mkety.com production repair workflow', () => {
  it('pins an exact hotfix SHA and isolates the repair to the dedicated app Worker', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('verified_sha');
    expect(workflow).toContain('REPAIR APP.MKETY.COM');
    expect(workflow).toContain('APP_WORKER_NAME: mkety-app-host');
    expect(workflow).toContain('HOTFIX_BRANCH: hotfix/app-mkety-com-20260928');
    expect(workflow).toContain('MKETY_HYPERDRIVE_NAME: mkety-production-db-v2');
    expect(workflow).not.toContain('APP_WORKER_NAME: mkety-platform');
  });

  it('backs up and restores app DNS before attaching the Worker Custom Domain', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('dns_records?name=app.mkety.com');
    expect(workflow).toContain('/tmp/app-dns-before.json');
    expect(workflow).toContain('restore()');
    expect(workflow).toContain("hostname:'app.mkety.com'");
    expect(workflow).toContain("service:process.env.WORKER");
    expect(workflow).toContain("if: failure() && steps.bind.outputs.bound == 'true'");
    expect(workflow).toContain('Live acceptance failed; restored the pre-repair app.mkety.com DNS state.');
  });

  it('verifies root, app login and ZITADEL first-hop behavior after attachment', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain("'https://app.mkety.com/'");
    expect(workflow).toContain("'https://app.mkety.com/app'");
    expect(workflow).toContain("'https://app.mkety.com/api/auth/login?returnTo=/app&intent=signin'");
    expect(workflow).toContain("u.pathname!=='/app'");
    expect(workflow).toContain("u.pathname!=='/login'");
    expect(workflow).toContain("u.origin!=='https://auth.mkety.com'");
  });
});
