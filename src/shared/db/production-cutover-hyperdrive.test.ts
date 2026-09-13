/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(process.cwd(), '.github/workflows/mkety-public-production-cutover.yml');

describe('production cutover Hyperdrive runtime binding', () => {
  it('discovers the Mkety-only Hyperdrive, binds MKETY_DB, and never sends DATABASE_URL to the Worker', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('MKETY_HYPERDRIVE_NAME: mkety-production-db');
    expect(workflow).toContain('/hyperdrive/configs?per_page=100');
    expect(workflow).toContain("item.name === process.env.MKETY_HYPERDRIVE_NAME");
    expect(workflow).toContain("binding: 'MKETY_DB'");
    expect(workflow).toContain('id: process.env.MKETY_HYPERDRIVE_ID');
    expect(workflow).not.toContain('put_secret DATABASE_URL');
    expect(workflow).toContain('Database runtime: MKETY_DB Hyperdrive binding');
  });
});
