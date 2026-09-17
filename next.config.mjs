import { fileURLToPath } from 'node:url';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const runtimeConnectionCloudflarePath = fileURLToPath(
  new URL('./src/shared/db/runtime-connection.cloudflare.ts', import.meta.url),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude pdf-parse from bundling to avoid issues with worker threads
  serverExternalPackages: ['pdf-parse'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/shared/db/runtime-connection': runtimeConnectionCloudflarePath,
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
