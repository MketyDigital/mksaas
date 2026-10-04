const mockDomainFindFirst = jest.fn();
const mockWorkspaceFindFirst = jest.fn();
const mockTenantFindFirst = jest.fn();
const mockResolveTenantMailPlanKey = jest.fn();
const mockCounts: Array<Array<{ value: number }>> = [];
const mockCountQuery = {
  from: jest.fn(),
  where: jest.fn(),
};

mockCountQuery.from.mockReturnValue(mockCountQuery);
mockCountQuery.where.mockImplementation(() => Promise.resolve(mockCounts.shift() ?? [{ value: 0 }]));

jest.mock('drizzle-orm', () => ({
  and: jest.fn(),
  count: jest.fn(() => 1),
  eq: jest.fn(),
  gte: jest.fn(),
}));

jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      mailDomains: { findFirst: (...args: unknown[]) => mockDomainFindFirst(...args) },
      mailWorkspaces: { findFirst: (...args: unknown[]) => mockWorkspaceFindFirst(...args) },
      tenants: { findFirst: (...args: unknown[]) => mockTenantFindFirst(...args) },
    },
    select: jest.fn(() => mockCountQuery),
  },
}));

jest.mock('@/shared/db/schema', () => ({
  mailCustomerUpdateRecipients: { tenantId: 'update-tenant', createdAt: 'update-created' },
  mailDomains: { id: 'domain-id', tenantId: 'domain-tenant', createdAt: 'domain-created' },
  mailMessages: { tenantId: 'message-tenant', direction: 'message-direction', createdAt: 'message-created' },
  mailWorkspaces: { tenantId: 'workspace-tenant', planKey: 'workspace-plan' },
  tenants: { id: 'tenant-id', slug: 'tenant-slug' },
}));

jest.mock('./commercial', () => ({
  MAIL_INTERNAL_CUSTOM_PROFILE_KEY: 'mail-internal-custom',
  resolveTenantMailPlanKey: (...args: unknown[]) => mockResolveTenantMailPlanKey(...args),
}));

import { getMailSendCapacity } from './sending-policy';

describe('getMailSendCapacity internal custom profile', () => {
  const previousLimit = process.env.MKETY_MAIL_DAILY_SEND_LIMIT;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCounts.length = 0;
    mockCountQuery.from.mockReturnValue(mockCountQuery);
    mockCountQuery.where.mockImplementation(() => Promise.resolve(mockCounts.shift() ?? [{ value: 0 }]));
    process.env.MKETY_MAIL_DAILY_SEND_LIMIT = '3000';
    mockDomainFindFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000) });
    mockWorkspaceFindFirst.mockResolvedValue({ planKey: 'mail-internal-custom' });
    mockTenantFindFirst.mockResolvedValue({ slug: 'mkety-ops' });
    mockResolveTenantMailPlanKey.mockImplementation((_tenantId, planKey, tenantSlug) =>
      planKey === 'mail-internal-custom' && tenantSlug === 'mkety-ops' ? 'mail-internal-custom' : 'mail-starter',
    );
  });

  afterAll(() => {
    if (previousLimit === undefined) delete process.env.MKETY_MAIL_DAILY_SEND_LIMIT;
    else process.env.MKETY_MAIL_DAILY_SEND_LIMIT = previousLimit;
  });

  it('does not apply public monthly message quotas to the reserved custom profile', async () => {
    mockCounts.push([{ value: 0 }], [{ value: 0 }], [{ value: 5000 }], [{ value: 0 }]);

    const capacity = await getMailSendCapacity('tenant-1', 'domain-1', 1, 'general');

    expect(capacity.allowed).toBe(true);
    expect(capacity.period).toBe('daily');
    expect(capacity.limit).toBe(3000);
    expect(mockResolveTenantMailPlanKey).toHaveBeenCalledWith(
      'tenant-1',
      'mail-internal-custom',
      'mkety-ops',
    );
  });

  it('keeps the platform daily send ceiling active for the internal custom profile', async () => {
    mockCounts.push([{ value: 3000 }], [{ value: 0 }], [{ value: 5000 }], [{ value: 0 }]);

    const capacity = await getMailSendCapacity('tenant-1', 'domain-1', 1, 'general');

    expect(capacity).toMatchObject({
      allowed: false,
      limit: 3000,
      used: 3000,
      remaining: 0,
      reason: 'daily_limit',
      period: 'daily',
    });
  });
});
