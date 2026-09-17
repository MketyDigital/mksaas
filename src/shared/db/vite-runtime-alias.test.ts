/** @jest-environment node */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const VITE_CONFIG_PATH = path.resolve(process.cwd(), 'vite.config.ts');
const NEXT_CONFIG_PATH = path.resolve(process.cwd(), 'next.config.mjs');
const WRANGLER_CONFIG_PATH = path.resolve(process.cwd(), 'wrangler.jsonc');
const DB_INDEX_PATH = path.resolve(process.cwd(), 'src/shared/db/index.ts');
const DB_REQUEST_PATH = path.resolve(process.cwd(), 'src/shared/db/request.ts');
const RUNTIME_CONNECTION_ID = '@/shared/db/runtime-connection';

describe('Cloudflare Worker database build wiring', () => {
  it('aliases the runtime database connection module to the Cloudflare adapter', async () => {
    const config = await readFile(VITE_CONFIG_PATH, 'utf8');

    expect(config).toContain("'@/shared/db/runtime-connection'");
    expect(config).toContain('runtime-connection.cloudflare.ts');
  });

  it('resolves the runtime database module to the Cloudflare adapter before generic tsconfig aliases', async () => {
    const script = `
      import { resolveConfig } from 'vite';
      (async () => {
        const id = ${JSON.stringify(RUNTIME_CONNECTION_ID)};
        const config = await resolveConfig(
          { configFile: ${JSON.stringify(VITE_CONFIG_PATH)}, logLevel: 'silent' },
          'build',
        );
        const matches = (find, value) => {
          if (find instanceof RegExp) {
            find.lastIndex = 0;
            return find.test(value);
          }
          return value === find || value.startsWith(find + '/');
        };
        const firstMatch = config.resolve.alias.find((alias) => matches(alias.find, id));
        process.stdout.write(firstMatch?.replacement ?? '');
      })().catch((error) => {
        console.error(error);
        process.exit(1);
      });
    `;
    const { stdout } = await execFileAsync('pnpm', ['exec', 'tsx', '-e', script], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
    });

    expect(stdout.trim().replaceAll('\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
  });

  it('exposes the exact Cloudflare resolver through Next webpack alias capture used by Vinext', async () => {
    const script = `
      import { pathToFileURL } from 'node:url';
      const module = await import(pathToFileURL(${JSON.stringify(NEXT_CONFIG_PATH)}).href);
      const config = module.default;
      const initial = { resolve: { alias: {} } };
      const resolved = typeof config.webpack === 'function'
        ? config.webpack(initial, { dev: false, isServer: true, nextRuntime: 'nodejs' })
        : initial;
      process.stdout.write(String(resolved?.resolve?.alias?.[${JSON.stringify(RUNTIME_CONNECTION_ID)}] ?? ''));
    `;
    const { stdout } = await execFileAsync(
      'node',
      ['--input-type=module', '--eval', script],
      {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024,
      },
    );

    expect(stdout.trim().replaceAll('\\', '/')).toMatch(
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
