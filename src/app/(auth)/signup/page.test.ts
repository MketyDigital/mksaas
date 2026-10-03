import { auth } from '@/shared/lib/auth';

import SignupPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
jest.mock('@/shared/lib/auth', () => ({ auth: jest.fn() }));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

describe('SignupPage', () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue(null);
  });

  it('preserves the public pricing plan and term through account creation', async () => {
    await expect(SignupPage({ searchParams: Promise.resolve({ plan: 'starter', term: '12m' }) }))
      .rejects.toThrow('REDIRECT:/api/auth/login?returnTo=%2Fselect-tenant%3Fplan%3Dstarter%26term%3D12m&intent=signup');
  });
});
