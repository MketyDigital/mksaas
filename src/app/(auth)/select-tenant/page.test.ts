import { auth } from '@/shared/lib/auth';
import { getAllRoles } from '@/shared/lib/rbac';

import SelectTenantPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

jest.mock('@/shared/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/shared/lib/rbac', () => ({ getAllRoles: jest.fn() }));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedGetAllRoles = getAllRoles as jest.MockedFunction<typeof getAllRoles>;

describe('SelectTenantPage', () => {
  it('selects current DB-backed memberships instead of stale session roles', async () => {
    mockedAuth.mockResolvedValue({
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        image: null,
        roles: { stale_workspace: 'admin' },
        permissions: {},
      },
    });
    mockedGetAllRoles.mockResolvedValue({ current_workspace: 'member' });

    await expect(SelectTenantPage()).rejects.toThrow('REDIRECT:/t/current_workspace');
    expect(mockedGetAllRoles).toHaveBeenCalledTimes(1);
  });
});
