/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(process.cwd(), '.github/workflows/mkety-public-production-cutover.yml');
const DEPLOY_SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/deploy-vinext-cloudflare.sh');

describe('production cutover Hyperdrive runtime binding', () => {
  it('discovers the Mkety-only Hyperdrive, binds MKETY_DB, verifies the generated deploy config, and never sends DATABASE_URL to the Worker', async () => {
    const [workflow, deployScript] = await Promise.all([
      readFile(WORKFLOW_PATH, 'utf8'),
      readFile(DEPLOY_SCRIPT_PATH, 'utf8'),
    ]);

    expect(workflow).toContain('MKETY_HYPERDRIVE_NAME: mkety-production-db');
    expect(workflow).toContain('/hyperdrive/configs?per_page=100');
    expect(workflow).toContain("item.name === process.env.MKETY_HYPERDRIVE_NAME");
    expect(workflow).toContain("binding: 'MKETY_DB'");
    expect(workflow).toContain('id: process.env.MKETY_HYPERDRIVE_ID');
    expect(deployScript).toContain('Generated Worker config lost MKETY_DB Hyperdrive binding.');
    expect(deployScript).toContain('MKETY_HYPERDRIVE_ID');
    expect(workflow).not.toContain('put_secret DATABASE_URL');
    expect(workflow).toContain('Database runtime: MKETY_DB Hyperdrive binding');
  });
});
