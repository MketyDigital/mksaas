import { auth } from '@/shared/lib/auth';

import LoginPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
jest.mock('@/shared/lib/auth', () => ({ auth: jest.fn() }));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

describe('LoginPage', () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue(null);
  });

  it('preserves the plan and term through sign-in', async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({ plan: 'starter', term: '12m' }) }))
      .rejects.toThrow('REDIRECT:/api/auth/login?returnTo=%2Fselect-tenant%3Fplan%3Dstarter%26term%3D12m&intent=signin');
  });
});
