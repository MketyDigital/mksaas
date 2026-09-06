import { redirect } from 'next/navigation';

import { auth } from '@/shared/lib/auth';
import { getAllRoles } from '@/shared/lib/rbac';

import TeamEntryPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

jest.mock('@/shared/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/shared/lib/rbac', () => ({ getAllRoles: jest.fn() }));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedGetAllRoles = getAllRoles as jest.MockedFunction<typeof getAllRoles>;
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('TeamEntryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes from current DB-backed memberships instead of stale session roles', async () => {
    mockedAuth.mockResolvedValue({
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        roles: { stale_workspace: 'admin' },
      },
    });
    mockedGetAllRoles.mockResolvedValue({ current_workspace: 'member' });

    await expect(TeamEntryPage()).rejects.toThrow('REDIRECT:/t/current_workspace/admin/members');
    expect(mockedGetAllRoles).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith('/t/current_workspace/admin/members');
  });
});
