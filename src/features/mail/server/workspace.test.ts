const mockRequireEntitlement = jest.fn();
const mockGetTenantBySlug = jest.fn();
const mockRequireTenantMembership = jest.fn();
const mockRequirePlatformControlAccess = jest.fn();
const mockRequirePermission = jest.fn();
const mockMembershipFindFirst = jest.fn();

jest.mock('@/features/entitlements/server/authorization', () => ({ requireEntitlement: (...args: unknown[]) => mockRequireEntitlement(...args) }));
jest.mock('@/features/platform-content/server/authorization', () => ({ requirePlatformControlAccess: (...args: unknown[]) => mockRequirePlatformControlAccess(...args) }));
jest.mock('@/shared/db/cloudflare', () => ({ db: { query: { mailWorkspaces: { findFirst: jest.fn() }, tenantMemberships: { findFirst: (...args: unknown[]) => mockMembershipFindFirst(...args) } }, insert: jest.fn() } }));
jest.mock('@/shared/db/schema', () => ({ mailWorkspaces: { tenantId: 'tenant-id' }, tenantMemberships: { tenantId: 'membership-tenant-id', userId: 'membership-user-id' } }));
jest.mock('@/shared/lib/permissions', () => ({ requireTenantMembership: (...args: unknown[]) => mockRequireTenantMembership(...args), requirePermission: (...args: unknown[]) => mockRequirePermission(...args) }));
jest.mock('@/shared/lib/tenant', () => ({ getTenantBySlug: (...args: unknown[]) => mockGetTenantBySlug(...args) }));
jest.mock('./commercial', () => ({ resolveTenantMailPlanKey: jest.fn() }));

import { requireMailWorkspaceAccess } from './workspace';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'reserved-tenant';
  process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG = 'mkety-ops';
  mockRequireEntitlement.mockResolvedValue(undefined);
  mockRequireTenantMembership.mockResolvedValue({ userId: 'customer-user', email: 'user@customer.com' });
  mockMembershipFindFirst.mockResolvedValue({ role: 'admin' });
});

describe('Mail workspace access boundary', () => {
  it('keeps customer Mail access on tenant membership and product entitlement checks', async () => {
    mockGetTenantBySlug.mockResolvedValue({ id: 'customer-tenant' });

    const access = await requireMailWorkspaceAccess('customer');

    expect(access.platformOperator).toBe(false);
    expect(mockRequireTenantMembership).toHaveBeenCalledWith('customer');
    expect(mockRequireEntitlement).toHaveBeenCalledWith({ tenantId: 'customer-tenant', entitlement: 'workspace.mail' });
    expect(mockRequirePlatformControlAccess).not.toHaveBeenCalled();
  });

  it('requires Platform Control identity and Mail operations permission for the reserved workspace', async () => {
    mockGetTenantBySlug.mockResolvedValue({ id: 'reserved-tenant' });
    mockRequirePlatformControlAccess.mockResolvedValue({ userId: 'operator', email: 'ops@mkety.com' });

    const access = await requireMailWorkspaceAccess('mkety-internal');

    expect(access.platformOperator).toBe(true);
    expect(access.membership.role).toBe('admin');
    expect(mockRequireTenantMembership).not.toHaveBeenCalled();
    expect(mockRequirePlatformControlAccess).toHaveBeenCalledWith('mkety-ops');
    expect(mockRequirePermission).toHaveBeenCalledWith('mkety-ops', 'platform:plans');
  });

  it('propagates operator authorization failures for the reserved workspace', async () => {
    mockGetTenantBySlug.mockResolvedValue({ id: 'reserved-tenant' });
    mockRequirePlatformControlAccess.mockRejectedValue(new Error('not an operator'));

    await expect(requireMailWorkspaceAccess('mkety-internal')).rejects.toThrow('not an operator');
  });
});
