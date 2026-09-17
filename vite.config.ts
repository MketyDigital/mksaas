import { fileURLToPath } from 'node:url';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';

const runtimeConnectionNodePath = fileURLToPath(
  new URL('./src/shared/db/runtime-connection.ts', import.meta.url)
);

const runtimeConnectionAlias = {
  find: '@/shared/db/runtime-connection',
  replacement: fileURLToPath(
    new URL('./src/shared/db/runtime-connection.cloudflare.ts', import.meta.url)
  ),
};

function prioritizeRuntimeConnectionAlias(): Plugin {
  return {
    name: 'mkety-runtime-connection-alias-precedence',
    enforce: 'pre',
    resolveId(source) {
      const sourceWithoutQuery = source.split(/[?#]/, 1)[0];

      if (
        source === runtimeConnectionAlias.find ||
        sourceWithoutQuery === runtimeConnectionNodePath
      ) {
        return runtimeConnectionAlias.replacement;
      }

      return null;
    },
    transform(_code, id) {
      const idWithoutQuery = id.split(/[?#]/, 1)[0];

      if (idWithoutQuery !== runtimeConnectionNodePath) {
        return null;
      }

      return {
        code: "export { getRuntimeDatabaseConnectionString } from './runtime-connection.cloudflare';",
        map: null,
      };
    },
    configResolved(config) {
      const aliases = config.resolve.alias;
      const existingIndex = aliases.findIndex(
        (alias) => alias.find === runtimeConnectionAlias.find
      );

      if (existingIndex >= 0) {
        aliases.splice(existingIndex, 1);
      }

      aliases.unshift(runtimeConnectionAlias);
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      [runtimeConnectionAlias.find]: runtimeConnectionAlias.replacement,
    },
  },
  plugins: [
    tailwindcss(),
    vinext({
      images: { optimizer: imagesOptimizer() },
    }),
    prioritizeRuntimeConnectionAlias(),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
});
