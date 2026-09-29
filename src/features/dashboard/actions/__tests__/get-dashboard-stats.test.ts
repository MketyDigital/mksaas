/**
 * Tests for getDashboardStats server action
 */

import { type AuthResult, createMockSession, createNullAuthResult } from '@/__tests__/mock-factories';

const mockAuthFn = jest.fn<Promise<AuthResult>, []>();
const mockGetTenantBySlug = jest.fn();

jest.mock('@/shared/db', () => ({
  db: {
    query: {
      auditEvents: { findMany: jest.fn() },
    },
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  },
}));

jest.mock('@/shared/lib/auth', () => ({
  auth: mockAuthFn,
}));

jest.mock('@/shared/lib/tenant', () => ({
  getTenantBySlug: mockGetTenantBySlug,
}));

jest.mock('@/shared/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { db as mockDb } from '@/shared/db';
import { getDashboardStats } from '../get-dashboard-stats';

describe('getDashboardStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantBySlug.mockResolvedValue({
      id: 'tenant-123',
      slug: 'test-tenant',
      name: 'Test Tenant',
    });
  });

  it('should return error when user is not authenticated', async () => {
    mockAuthFn.mockResolvedValue(createNullAuthResult());

    const result = await getDashboardStats('test-tenant');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('should reject an authenticated user who is not a member of the tenant', async () => {
    mockAuthFn.mockResolvedValue(createMockSession({
      user: { roles: { 'other-tenant': 'member' } },
    }));

    const result = await getDashboardStats('test-tenant');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.query.auditEvents.findMany).not.toHaveBeenCalled();
  });

  it('should return dashboard stats for an authenticated tenant member', async () => {
    mockAuthFn.mockResolvedValue(createMockSession());

    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });

    (mockDb.query.auditEvents.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'event-1',
        action: 'member.created',
        entityType: 'person',
        entityId: 'person-1',
        timestamp: new Date(),
        metadata: null,
      },
    ]);

    const result = await getDashboardStats('test-tenant');

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.teamSize).toBe(5);
      expect(result.data.recentActivity).toHaveLength(1);
    }
  });

  it('should handle errors gracefully', async () => {
    mockAuthFn.mockRejectedValue(new Error('Database error'));

    const result = await getDashboardStats('test-tenant');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch dashboard stats');
  });
});
