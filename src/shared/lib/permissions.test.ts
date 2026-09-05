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

const authMock = auth as unknown as jest.Mock;
const getTenantBySlugMock = getTenantBySlug as unknown as jest.Mock;
const tenantMembershipsFindFirstMock = db.query.tenantMemberships.findFirst as unknown as jest.Mock;
const tenantMembershipRolesFindManyMock = db.query.tenantMembershipRoles.findMany as unknown as jest.Mock;
const rolePermissionsFindManyMock = db.query.rolePermissions.findMany as unknown as jest.Mock;
const permissionsFindManyMock = db.query.permissions.findMany as unknown as jest.Mock;

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
      }),
    );

    await expect(getCurrentUserPermissions('current-tenant')).resolves.toEqual([]);
    expect(getTenantBySlugMock).toHaveBeenCalledWith('current-tenant');
    expect(tenantMembershipsFindFirstMock).toHaveBeenCalledTimes(1);
  });
});
