import { fileURLToPath } from 'node:url';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@/shared/db/runtime-connection': fileURLToPath(
        new URL('./src/shared/db/runtime-connection.cloudflare.ts', import.meta.url)
      ),
    },
  },
  plugins: [
    tailwindcss(),
    vinext({
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
});
