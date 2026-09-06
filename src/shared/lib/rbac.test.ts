import { db } from '@/shared/db';
import type { MketySession } from '@/shared/lib/auth/types';
import { auth } from '@/shared/lib/auth';
import { hasPermission } from '@/shared/lib/permissions';
import { getAllRoles, getCurrentRole, requireRole } from '@/shared/lib/rbac';
import { getTenantBySlug } from '@/shared/lib/tenant';

jest.mock('@/shared/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/shared/lib/permissions', () => ({
  hasPermission: jest.fn(),
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
const hasPermissionMock = jest.mocked(hasPermission);
const getTenantBySlugMock = jest.mocked(getTenantBySlug);
const tenantMembershipsFindFirstMock = jest.mocked(db.query.tenantMemberships.findFirst);
const tenantMembershipsFindManyMock = jest.mocked(db.query.tenantMemberships.findMany);

function sessionWithRoles(roles: MketySession['user']['roles']): MketySession {
  return {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      image: null,
      roles,
      permissions: {},
    },
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
  };
}

describe('RBAC role helpers', () => {
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
    hasPermissionMock.mockResolvedValue(true);
  });

  it('does not return a stale session role when current tenant membership is gone', async () => {
    authMock.mockResolvedValue(sessionWithRoles({ 'current-tenant': 'admin' }));

    await expect(getCurrentRole('current-tenant')).resolves.toBeNull();
    expect(getTenantBySlugMock).toHaveBeenCalledWith('current-tenant');
    expect(tenantMembershipsFindFirstMock).toHaveBeenCalledTimes(1);
  });

  it('returns all current roles from tenant memberships instead of session role cache', async () => {
    authMock.mockResolvedValue(sessionWithRoles({ stale: 'admin' }));
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

  it('returns the current membership role from requireRole instead of a stale session role', async () => {
    authMock.mockResolvedValue(sessionWithRoles({ 'current-tenant': 'admin' }));
    tenantMembershipsFindFirstMock.mockResolvedValue({ role: 'manager' });

    await expect(requireRole('current-tenant', 'member')).resolves.toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'manager',
    });
  });
});
