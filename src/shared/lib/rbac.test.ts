import { createMockSession } from '@/__tests__/mock-factories';
import { db } from '@/shared/db';
import { auth } from '@/shared/lib/auth';
import { getAllRoles, getCurrentRole } from '@/shared/lib/rbac';
import { getTenantBySlug } from '@/shared/lib/tenant';

jest.mock('@/shared/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/shared/lib/tenant', () => ({
  getTenantBySlug: jest.fn(),
}));

jest.mock('@/shared/db', () => ({
  db: {
    query: {
      tenantMemberships: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
  },
}));

const authMock = jest.mocked(auth);
const getTenantBySlugMock = jest.mocked(getTenantBySlug);
const tenantMembershipsFindFirstMock = jest.mocked(db.query.tenantMemberships.findFirst);
const tenantMembershipsFindManyMock = jest.mocked(db.query.tenantMemberships.findMany);

describe('RBAC session role helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTenantBySlugMock.mockResolvedValue({
      id: 'tenant-current',
      name: 'Current Tenant',
      slug: 'current-tenant',
      description: null,
      settings: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    tenantMembershipsFindFirstMock.mockResolvedValue(null);
    tenantMembershipsFindManyMock.mockResolvedValue([]);
  });

  it('does not return a stale session role when the user has no current tenant membership', async () => {
    authMock.mockResolvedValue(
      createMockSession({
        user: {
          id: 'user-1',
          roles: {
            'current-tenant': 'admin',
          },
        },
      })
    );

    await expect(getCurrentRole('current-tenant')).resolves.toBeNull();
    expect(getTenantBySlugMock).toHaveBeenCalledWith('current-tenant');
    expect(tenantMembershipsFindFirstMock).toHaveBeenCalledTimes(1);
  });

  it('returns all current roles from tenant memberships instead of session cache', async () => {
    authMock.mockResolvedValue(
      createMockSession({
        user: {
          id: 'user-1',
          roles: {
            stale: 'admin',
          },
        },
      })
    );
    tenantMembershipsFindManyMock.mockResolvedValue([
      {
        role: 'manager',
        tenant: {
          slug: 'current-tenant',
        },
      },
    ]);

    await expect(getAllRoles()).resolves.toEqual({ 'current-tenant': 'manager' });
    expect(tenantMembershipsFindManyMock).toHaveBeenCalledTimes(1);
  });
});
