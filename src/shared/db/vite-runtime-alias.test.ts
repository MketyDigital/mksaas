/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveConfig } from 'vite';

const VITE_CONFIG_PATH = path.resolve(process.cwd(), 'vite.config.ts');
const WRANGLER_CONFIG_PATH = path.resolve(process.cwd(), 'wrangler.jsonc');
const DB_INDEX_PATH = path.resolve(process.cwd(), 'src/shared/db/index.ts');
const DB_REQUEST_PATH = path.resolve(process.cwd(), 'src/shared/db/request.ts');
const RUNTIME_CONNECTION_ID = '@/shared/db/runtime-connection';

function aliasMatches(find: string | RegExp, id: string): boolean {
  if (find instanceof RegExp) {
    find.lastIndex = 0;
    return find.test(id);
  }

  return id === find || id.startsWith(`${find}/`);
}

describe('Cloudflare Worker database build wiring', () => {
  it('aliases the runtime database connection module to the Cloudflare adapter', async () => {
    const config = await readFile(VITE_CONFIG_PATH, 'utf8');

    expect(config).toContain("'@/shared/db/runtime-connection'");
    expect(config).toContain('runtime-connection.cloudflare.ts');
  });

  it('resolves the runtime database module to the Cloudflare adapter before generic tsconfig aliases', async () => {
    const config = await resolveConfig(
      { configFile: VITE_CONFIG_PATH, logLevel: 'silent' },
      'build',
    );
    const firstMatch = config.resolve.alias.find((alias) => aliasMatches(alias.find, RUNTIME_CONNECTION_ID));

    expect(firstMatch).toBeDefined();
    expect(firstMatch?.replacement.replaceAll('\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
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

  it('allows Vinext Worker fetches to public Workers on the same Cloudflare zone', async () => {
    const config = JSON.parse(await readFile(WRANGLER_CONFIG_PATH, 'utf8')) as {
      compatibility_flags?: string[];
    };

    expect(config.compatibility_flags).toEqual(
      expect.arrayContaining(['nodejs_compat', 'global_fetch_strictly_public']),
    );
  });
});
