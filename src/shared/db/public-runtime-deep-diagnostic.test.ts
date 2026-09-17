/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-prod-hyperdrive-deep-diagnostic.yml',
);

describe('production runtime deep diagnostic', () => {
  it('probes database resolution and both app database wrappers inside the Vinext bundle', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('/api/_diagnostics/runtime-db');
    expect(workflow).toContain('runtime-resolver');
    expect(workflow).toContain('request-database');
    expect(workflow).toContain('singleton-database');
    expect(workflow).toContain('RUNTIME_DB_DIAGNOSTIC');
  });
});
