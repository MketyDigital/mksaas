process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? 'true';

import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

import '@testing-library/jest-dom';

// Mkety Auth and Public Mkety AI deliberately use Web-standard crypto APIs so
// the same primitives work in browsers, Node, and Cloudflare Workers. jsdom
// does not expose the complete modern Web Crypto / Encoding surface, therefore
// the test harness supplies the standards-compatible Node implementations.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
}
if (!globalThis.TextEncoder) {
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: TextEncoder,
  });
}
if (!globalThis.TextDecoder) {
  Object.defineProperty(globalThis, 'TextDecoder', {
    configurable: true,
    value: TextDecoder,
  });
}
if (!globalThis.fetch) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
}

// ============================================================================
// Global Mocks
// ============================================================================

// Runtime environment validation uses an ESM-only dependency. Unit tests
// exercise consumers, not environment parsing, so keep that boundary explicit
// and deterministic. Do not reintroduce Auth.js/NextAuth mocks here: Mkety owns
// the application auth/session boundary and ZITADEL is only the OIDC adapter.
jest.mock('@/shared/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    MKETY_AUTH_PROVIDER: 'zitadel',
    MKETY_AUTH_ISSUER: 'https://example.zitadel.cloud',
    MKETY_AUTH_CLIENT_ID: 'mkety-test-client',
    MKETY_AUTH_CLIENT_SECRET: 'test-client-secret',
    MKETY_AUTH_REDIRECT_URI: 'https://preview.example.workers.dev/api/auth/callback',
    MKETY_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://preview.example.workers.dev/login',
    MKETY_AUTH_SESSION_SECRET: 'test-session-secret-that-is-long-enough',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: 'Mkety',
    ENABLE_AI_FEATURES: false,
    ENABLE_TEST_LOGIN: false,
    MKETY_AI_PROVIDER: 'openai',
    MKETY_AI_MODEL: 'gpt-4o-mini',
    MKETY_PUBLIC_AI_ENABLED: false,
    MKETY_PUBLIC_AI_PRIMARY_PROVIDER: 'openai',
    MKETY_PUBLIC_AI_FALLBACK_PROVIDERS: '',
    AWS_REGION: 'us-east-1',
    S3_REGION: 'us-east-1',
  },
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ tenant: 'test-tenant' }),
}));

jest.mock('next/link', () => {
  const Link = ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
  return Link;
});

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)'))
    ) return;
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
