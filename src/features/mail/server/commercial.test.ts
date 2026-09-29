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
});
