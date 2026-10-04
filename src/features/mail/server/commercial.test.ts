const mockGetCurrentPlanVersionIds = jest.fn();
const mockQuery = {
  from: jest.fn(),
  innerJoin: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
};

mockQuery.from.mockReturnValue(mockQuery);
mockQuery.innerJoin.mockReturnValue(mockQuery);
mockQuery.where.mockReturnValue(mockQuery);
mockQuery.orderBy.mockReturnValue(mockQuery);

jest.mock('@/features/entitlements/server/drizzle-source', () => ({
  drizzleEntitlementSource: {
    getCurrentPlanVersionIds: mockGetCurrentPlanVersionIds,
  },
}));

jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    select: jest.fn(() => mockQuery),
  },
}));

import { db } from '@/shared/db/cloudflare';

import { resolveTenantMailPlanKey } from './commercial';

const resolveTenantMailProfileKey = resolveTenantMailPlanKey as unknown as (
  tenantId: string,
  fallbackPlanKey: string,
  tenantSlug: string,
) => Promise<string>;

describe('resolveTenantMailPlanKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.from.mockReturnValue(mockQuery);
    mockQuery.innerJoin.mockReturnValue(mockQuery);
    mockQuery.where.mockReturnValue(mockQuery);
    mockQuery.orderBy.mockReturnValue(mockQuery);
  });

  it('falls back without reading subscription tiers when no subscription currently qualifies for entitlement access', async () => {
    mockGetCurrentPlanVersionIds.mockResolvedValue([]);

    await expect(resolveTenantMailPlanKey('tenant-1', 'mail-growth')).resolves.toBe('mail-growth');

    expect(mockGetCurrentPlanVersionIds).toHaveBeenCalledWith('tenant-1');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('only resolves a Mail tier through plan versions accepted by the entitlement authority', async () => {
    mockGetCurrentPlanVersionIds.mockResolvedValue(['plan-version-current']);
    mockQuery.limit.mockResolvedValue([{ planKey: 'mail-business' }]);

    await expect(resolveTenantMailPlanKey('tenant-1', 'mail-starter')).resolves.toBe('mail-business');

    expect(mockGetCurrentPlanVersionIds).toHaveBeenCalledWith('tenant-1');
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(mockQuery.where).toHaveBeenCalledTimes(1);
    expect(mockQuery.limit).toHaveBeenCalledWith(1);
  });

  it('does not silently convert the private internal custom marker into a paid Starter plan', async () => {
    mockGetCurrentPlanVersionIds.mockResolvedValue([]);

    await expect(resolveTenantMailPlanKey('tenant-1', 'mail-internal-custom')).rejects.toThrow(
      'Internal custom Mail profiles must use the reserved-tenant profile resolver.',
    );

    expect(db.select).not.toHaveBeenCalled();
  });

  it('resolves the private custom profile only for the configured reserved tenant and slug', async () => {
    const previousTenantId = process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID;
    process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'tenant-1';
    mockGetCurrentPlanVersionIds.mockResolvedValue([]);

    try {
      await expect(resolveTenantMailProfileKey('tenant-1', 'mail-internal-custom', 'mkety-ops')).resolves.toBe(
        'mail-internal-custom',
      );
      expect(db.select).not.toHaveBeenCalled();
    } finally {
      if (previousTenantId === undefined) delete process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID;
      else process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = previousTenantId;
    }
  });

  it.each([
    ['another tenant', 'tenant-2', 'mkety-ops'],
    ['another slug', 'tenant-1', 'customer'],
  ])('rejects the internal custom profile for %s', async (_label, tenantId, tenantSlug) => {
    const previousTenantId = process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID;
    process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = 'tenant-1';

    try {
      await expect(resolveTenantMailProfileKey(tenantId, 'mail-internal-custom', tenantSlug)).rejects.toThrow(
        'Internal custom Mail profile is restricted to the configured /mkety-ops tenant.',
      );
    } finally {
      if (previousTenantId === undefined) delete process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID;
      else process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID = previousTenantId;
    }
  });
});
