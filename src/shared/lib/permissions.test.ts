import { createMockSession } from '@/__tests__/mock-factories';
import { db } from '@/shared/db';
import { auth } from '@/shared/lib/auth';
import { getCurrentUserPermissions } from '@/shared/lib/permissions';
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
      },
      tenantMembershipRoles: {
        findMany: jest.fn(),
      },
      rolePermissions: {
        findMany: jest.fn(),
      },
      permissions: {
        findMany: jest.fn(),
      },
    },
  },
}));

const authMock = jest.mocked(auth);
const getTenantBySlugMock = jest.mocked(getTenantBySlug);
const tenantMembershipsFindFirstMock = jest.mocked(db.query.tenantMemberships.findFirst);
const tenantMembershipRolesFindManyMock = jest.mocked(db.query.tenantMembershipRoles.findMany);
const rolePermissionsFindManyMock = jest.mocked(db.query.rolePermissions.findMany);
const permissionsFindManyMock = jest.mocked(db.query.permissions.findMany);

describe('getCurrentUserPermissions', () => {
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
    tenantMembershipRolesFindManyMock.mockResolvedValue([]);
    rolePermissionsFindManyMock.mockResolvedValue([]);
    permissionsFindManyMock.mockResolvedValue([]);
  });

  it('does not trust stale session permissions when the user has no current tenant membership', async () => {
    authMock.mockResolvedValue(
      createMockSession({
        user: {
          id: 'user-1',
          permissions: {
            'current-tenant': ['*'],
          },
        },
      })
    );

    await expect(getCurrentUserPermissions('current-tenant')).resolves.toEqual([]);
    expect(getTenantBySlugMock).toHaveBeenCalledWith('current-tenant');
    expect(tenantMembershipsFindFirstMock).toHaveBeenCalledTimes(1);
  });
});
