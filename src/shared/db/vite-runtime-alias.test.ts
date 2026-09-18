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
const DB_CLOUDFLARE_PATH = path.resolve(process.cwd(), 'src/shared/db/cloudflare.ts');
const DB_REQUEST_PATH = path.resolve(process.cwd(), 'src/shared/db/request.ts');
const PUBLIC_AI_REQUEST_DB_PATH = path.resolve(
  process.cwd(),
  'src/features/public-assistant/server/request-database.ts',
);
const NODE_DB_PATH = path.resolve(process.cwd(), 'src/shared/db/node.ts');
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

    expect(stdout.trim().replaceAll('\\\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
  });

  it('intercepts the runtime database module in a pre-resolution Vite resolveId hook', async () => {
    const script = `
      import { resolveConfig } from 'vite';
      (async () => {
        const id = ${JSON.stringify(RUNTIME_CONNECTION_ID)};
        const config = await resolveConfig(
          { configFile: ${JSON.stringify(VITE_CONFIG_PATH)}, logLevel: 'silent' },
          'build',
        );
        const plugin = config.plugins.find(
          (candidate) => candidate.name === 'mkety-runtime-connection-alias-precedence',
        );
        const handler = plugin?.resolveId;
        const hook = typeof handler === 'function' ? handler : handler?.handler;
        const result = typeof hook === 'function'
          ? await hook.call({} , id, undefined, {})
          : null;
        const resolvedId = typeof result === 'string' ? result : result?.id ?? '';
        process.stdout.write(JSON.stringify({
          enforce: plugin?.enforce ?? null,
          resolvedId,
        }));
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
    const result = JSON.parse(stdout.trim()) as {
      enforce: string | null;
      resolvedId: string;
    };

    expect(result.enforce).toBe('pre');
    expect(result.resolvedId.replaceAll('\\\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
  });

  it('redirects Vinext absolute Node resolver paths to the Cloudflare adapter', async () => {
    const absoluteNodeResolver = path.resolve(
      process.cwd(),
      'src/shared/db/runtime-connection.ts',
    );
    const script = `
      import { resolveConfig } from 'vite';
      (async () => {
        const source = ${JSON.stringify(absoluteNodeResolver)};
        const config = await resolveConfig(
          { configFile: ${JSON.stringify(VITE_CONFIG_PATH)}, logLevel: 'silent' },
          'build',
        );
        const plugin = config.plugins.find(
          (candidate) => candidate.name === 'mkety-runtime-connection-alias-precedence',
        );
        const handler = plugin?.resolveId;
        const hook = typeof handler === 'function' ? handler : handler?.handler;
        const result = typeof hook === 'function'
          ? await hook.call({}, source, undefined, {})
          : null;
        const resolvedId = typeof result === 'string' ? result : result?.id ?? '';
        process.stdout.write(resolvedId);
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

    expect(stdout.trim().replaceAll('\\\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
  });

  it('exposes the exact Cloudflare resolver through Next webpack alias capture used by Vinext', async () => {
    const script = `
      import { pathToFileURL } from 'node:url';
      const module = await import(pathToFileURL(${JSON.stringify(NEXT_CONFIG_PATH)}).href);
      const config = module.default;
      const initial = { context: process.cwd(), resolve: { alias: {} } };
      const resolved = typeof config.webpack === 'function'
        ? config.webpack(initial, {
            dev: false,
            dir: process.cwd(),
            isServer: true,
            nextRuntime: 'nodejs',
          })
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

    expect(stdout.trim().replaceAll('\\\\', '/')).toMatch(
      /\/src\/shared\/db\/runtime-connection\.cloudflare\.ts$/,
    );
  });

  it('routes Worker database gateways directly through the Cloudflare adapter', async () => {
    const [dbIndex, cloudflareDatabase, requestDatabase, publicAIRequestDatabase, nodeDatabase] =
      await Promise.all([
        readFile(DB_INDEX_PATH, 'utf8'),
        readFile(DB_CLOUDFLARE_PATH, 'utf8'),
        readFile(DB_REQUEST_PATH, 'utf8'),
        readFile(PUBLIC_AI_REQUEST_DB_PATH, 'utf8'),
        readFile(NODE_DB_PATH, 'utf8'),
      ]);

    expect(dbIndex).toContain("from '@/shared/db/runtime-connection'");
    expect(dbIndex).not.toContain('runtime-connection.cloudflare');
    expect(cloudflareDatabase).toContain("from './runtime-connection.cloudflare'");
    expect(requestDatabase).toContain("from '@/shared/db/runtime-connection.cloudflare'");
    expect(publicAIRequestDatabase).toContain(
      "from '@/shared/db/runtime-connection.cloudflare'",
    );
    expect(requestDatabase).not.toContain("from '@/shared/db/runtime-connection'");
    expect(publicAIRequestDatabase).not.toContain("from '@/shared/db/runtime-connection'");
    expect(nodeDatabase).toContain("from './runtime-connection'");
    expect(nodeDatabase).not.toContain('runtime-connection.cloudflare');
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
