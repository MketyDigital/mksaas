/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const VITE_CONFIG_PATH = path.resolve(process.cwd(), 'vite.config.ts');
const DB_INDEX_PATH = path.resolve(process.cwd(), 'src/shared/db/index.ts');
const DB_REQUEST_PATH = path.resolve(process.cwd(), 'src/shared/db/request.ts');

describe('Cloudflare Worker database build wiring', () => {
  it('aliases the runtime database connection module to the Cloudflare adapter', async () => {
    const config = await readFile(VITE_CONFIG_PATH, 'utf8');

    expect(config).toContain("'@/shared/db/runtime-connection'");
    expect(config).toContain('runtime-connection.cloudflare.ts');
  });

  it('routes runtime database consumers through the aliased module', async () => {
    const [dbIndex, requestDatabase] = await Promise.all([
      readFile(DB_INDEX_PATH, 'utf8'),
      readFile(DB_REQUEST_PATH, 'utf8'),
    ]);

    expect(dbIndex).toContain("from '@/shared/db/runtime-connection'");
    expect(requestDatabase).toContain("from '@/shared/db/runtime-connection'");
    expect(dbIndex).not.toContain("from './runtime-connection'");
    expect(requestDatabase).not.toContain("from './runtime-connection'");
  });
});
