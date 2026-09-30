import type { StorybookConfig } from '@storybook/nextjs-vite';
import path from 'path';

const stubDir = path.resolve(process.cwd(), '.storybook');
const emptyModule = path.join(stubDir, 'empty-module.js');

const config: StorybookConfig = {
  stories: [
    '../src/shared/components/ui/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../src/features/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [],
  framework: {
    name: '@storybook/nextjs-vite',
    // Keep app-only Vinext/RSC plugins out of the component preview build.
    options: { builder: { viteConfigPath: path.join(stubDir, 'vite.config.ts') } },
  },
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    // Stub Node built-ins so server-only deps (e.g. postgres via mention search) don't break the browser bundle
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd(), 'src'),
      perf_hooks: path.join(stubDir, 'perf_hooks-stub.js'),
      fs: emptyModule,
      net: emptyModule,
      tls: emptyModule,
    };
    return config;
  },
};

export default config;
