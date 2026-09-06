process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? 'true';

import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

import '@testing-library/jest-dom';

// Mkety Auth deliberately uses Web-standard crypto APIs so the same primitives work
// in browsers and Cloudflare Workers. jsdom does not expose all Node 22 Web globals,
// therefore the test harness supplies the standards-compatible Node implementations.
Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

// ============================================================================
// Global Mocks
// ============================================================================

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
