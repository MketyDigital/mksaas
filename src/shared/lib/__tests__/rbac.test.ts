/**
 * Tests for RBAC capability and permission mapping utilities.
 *
 * Current membership-backed role resolution is covered separately in
 * src/shared/lib/rbac.test.ts. This suite intentionally does not duplicate
 * the old session-role contract because serialized session roles are no
 * longer an authorization source of truth.
 */

jest.mock('../permissions', () => ({
  hasPermission: jest.fn(),
}));

import { type Capability, hasCapability, hasRole, isTenantAdmin, isTenantManager, isTenantMember, RoleCapabilities, roleHasCapability } from '../rbac';
// eslint-disable-next-line import/order -- must import after jest.mock
import { hasPermission } from '../permissions';

const mockHasPermissionFn = hasPermission as jest.MockedFunction<typeof hasPermission>;

describe('rbac capability mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RoleCapabilities', () => {
    it('defines member capabilities', () => {
      expect(RoleCapabilities.member).toContain('view_own_profile');
      expect(RoleCapabilities.member).toContain('use_assistant');
      expect(RoleCapabilities.member).toContain('view_knowledge');
    });

    it('defines manager capabilities including member-level access', () => {
      expect(RoleCapabilities.manager).toContain('view_own_profile');
      expect(RoleCapabilities.manager).toContain('view_team');
      expect(RoleCapabilities.manager).toContain('view_team_reports');
    });

    it('defines admin capabilities including administrative access', () => {
      expect(RoleCapabilities.admin).toContain('manage_knowledge');
      expect(RoleCapabilities.admin).toContain('manage_members');
      expect(RoleCapabilities.admin).toContain('view_admin');
    });
  });

  describe('roleHasCapability', () => {
    it('honors the static UI capability map', () => {
      expect(roleHasCapability('member', 'view_own_profile')).toBe(true);
      expect(roleHasCapability('member', 'view_team')).toBe(false);
      expect(roleHasCapability('manager', 'view_team')).toBe(true);
      expect(roleHasCapability('manager', 'manage_members')).toBe(false);
      expect(roleHasCapability('admin', 'manage_members')).toBe(true);
    });

    it('fails closed for missing or unknown capabilities', () => {
      expect(roleHasCapability(undefined, 'view_own_profile')).toBe(false);
      expect(roleHasCapability('admin', 'non_existent' as Capability)).toBe(false);
    });
  });

  describe('role permission mapping', () => {
    it.each([
      ['admin', 'admin:settings'],
      ['manager', 'manager:dashboard'],
      ['member', 'profile:read'],
    ] as const)('maps %s to %s', async (role, permission) => {
      mockHasPermissionFn.mockResolvedValue(true);

      await expect(hasRole('test-tenant', role)).resolves.toBe(true);
      expect(mockHasPermissionFn).toHaveBeenCalledWith('test-tenant', permission);
    });

    it('fails closed when the permission check fails', async () => {
      mockHasPermissionFn.mockResolvedValue(false);
      await expect(hasRole('test-tenant', 'admin')).resolves.toBe(false);
    });

    it('routes tenant convenience helpers through permission checks', async () => {
      mockHasPermissionFn.mockResolvedValue(true);

      await isTenantAdmin('test-tenant');
      expect(mockHasPermissionFn).toHaveBeenLastCalledWith('test-tenant', 'admin:settings');

      await isTenantManager('test-tenant');
      expect(mockHasPermissionFn).toHaveBeenLastCalledWith('test-tenant', 'manager:dashboard');

      await isTenantMember('test-tenant');
      expect(mockHasPermissionFn).toHaveBeenLastCalledWith('test-tenant', 'profile:read');
    });
  });

  describe('capability permission mapping', () => {
    it.each([
      ['view_own_profile', 'profile:read'],
      ['use_assistant', 'assistant:use'],
      ['view_team', 'manager:team'],
      ['manage_members', 'admin:members'],
      ['manage_knowledge', 'admin:knowledge'],
    ] as const)('maps %s to %s', async (capability, permission) => {
      mockHasPermissionFn.mockResolvedValue(true);

      await expect(hasCapability('test-tenant', capability)).resolves.toBe(true);
      expect(mockHasPermissionFn).toHaveBeenCalledWith('test-tenant', permission);
    });

    it('fails closed for an unknown capability', async () => {
      await expect(hasCapability('test-tenant', 'unknown' as Capability)).resolves.toBe(false);
    });
  });
});
