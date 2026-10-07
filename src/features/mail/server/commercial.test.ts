const mockGetCurrentPlanVersionIds = jest.fn();
const mockFindMailEnterpriseOffer = jest.fn();
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
    query: { mailEnterpriseOffers: { findFirst: (...args: unknown[]) => mockFindMailEnterpriseOffer(...args) } },
  },
}));

import fs from 'node:fs';
import path from 'node:path';

import { db } from '@/shared/db/cloudflare';

import { formatMailPlanPrice, getMailPlanManagementDestination, resolveTenantMailPlanKey, resolveTenantMailPlanLimits, resolveTenantMailPlanDisplay } from './commercial';

const resolveTenantMailProfileKey = resolveTenantMailPlanKey as unknown as (
  tenantId: string,
  fallbackPlanKey: string,
  tenantSlug: string,
) => Promise<string>;

describe('resolveTenantMailPlanKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMailEnterpriseOffer.mockResolvedValue(null);
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

  it('resolves the custom commercial profile only from a paid active tenant offer', async () => {
    mockFindMailEnterpriseOffer.mockResolvedValue({ id: 'paid-offer', status: 'active' });

    await expect(resolveTenantMailPlanKey('tenant-1', 'mail-starter')).resolves.toBe('mail-enterprise-custom');
    expect(mockGetCurrentPlanVersionIds).not.toHaveBeenCalled();
  });

  it('preserves an expired Enterprise marker so limit resolution can fail closed without breaking Ops views', async () => {
    await expect(resolveTenantMailPlanKey('tenant-1', 'mail-enterprise-custom')).resolves.toBe('mail-enterprise-custom');
    await expect(resolveTenantMailPlanLimits('tenant-1', 'mail-enterprise-custom')).rejects.toThrow('limits are unavailable');
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


describe('Mail Enterprise billing presentation', () => {
  beforeEach(() => {
    mockFindMailEnterpriseOffer.mockResolvedValue({
      id: 'paid-offer', name: 'Starpips Mail Enterprise', amountMinor: 250000n, currency: 'USD', termDays: 365, status: 'active',
    });
  });

  it('returns and formats the paid term without routing Enterprise Mail into self-service checkout', async () => {
    await expect(resolveTenantMailPlanDisplay('tenant-1', 'mail-enterprise-custom')).resolves.toEqual({
      name: 'Starpips Mail Enterprise', amountMinor: 250000n, currency: 'USD', termDays: 365,
    });

    expect(formatMailPlanPrice(250000n, 'mail-enterprise-custom', 365, 'USD')).toBe('$2,500.00 / 365-day term');
    expect(formatMailPlanPrice(250000n, 'mail-enterprise-custom', null, 'USD')).toBe(
      '$2,500.00 · one-time, no fixed end date',
    );
    expect(formatMailPlanPrice(499n, 'mail-starter', null, 'USD')).toBe(
      '$4.99 / month before prepaid-term discounts',
    );
    expect(getMailPlanManagementDestination('customer', 'mail-enterprise-custom')).toBeNull();
    expect(getMailPlanManagementDestination('customer', 'mail-starter')).toEqual({
      href: '/app/customer/billing/checkout?plan=mail-starter',
      label: 'Manage plan →',
    });

    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/app/[tenant]/mail/page.tsx'), 'utf8');
    expect(page).toContain('usage.termDays');
    expect(page).toContain('usage.currency');
    expect(page).not.toContain('billing/checkout?plan=\u0024{usage.planKey}');
  });
});
