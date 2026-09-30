import { defineConfig } from 'vite';

// Storybook supplies its own React/Next preview plugins; app RSC plugins cannot
// produce their server asset manifest in this browser-only build.
export default defineConfig({});
