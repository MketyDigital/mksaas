/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const VITE_CONFIG_PATH = path.resolve(process.cwd(), 'vite.config.ts');

describe('Cloudflare Worker database build wiring', () => {
  it('aliases the runtime database connection module to the Cloudflare adapter', async () => {
    const config = await readFile(VITE_CONFIG_PATH, 'utf8');

    expect(config).toContain("'@/shared/db/runtime-connection'");
    expect(config).toContain("runtime-connection.cloudflare.ts");
  });
});
