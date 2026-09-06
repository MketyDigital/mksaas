process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? 'true';

import '@testing-library/jest-dom';

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
  const Link = ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode; href: string }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
  return Link;
});

jest.mock('@/shared/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue(null),
  signIn: jest.fn().mockRejectedValue(new Error('Mkety identity is not configured yet.')),
  signOut: jest.fn().mockRejectedValue(new Error('Mkety identity is not configured yet.')),
}));

jest.mock('@/shared/lib/auth-client', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: jest.fn().mockResolvedValue({ error: 'Mkety identity is not configured yet.', url: null }),
  signOut: jest.fn().mockResolvedValue(undefined),
}));

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
