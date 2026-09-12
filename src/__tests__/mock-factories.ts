/**
 * Type-Safe Mock Factories
 *
 * Provides fully typed mock factories for testing Mkety-owned application
 * sessions and common domain records.
 */

import type { TenantRole } from '@/shared/db/schema/auth';
import type { Tenant } from '@/shared/db/schema/tenants';
import type { MketySession, MketySessionUser } from '@/shared/lib/auth/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AuthResult = MketySession | null;

export interface MockSessionUserOverrides {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  roles?: Record<string, TenantRole>;
  permissions?: Record<string, string[]>;
}

export interface MockSessionOverrides {
  user?: MockSessionUserOverrides;
  expiresAt?: Date;
}

export type MockTenant = Tenant;
export type MockTenantOverrides = Partial<Tenant>;

// ============================================================================
// SESSION MOCK FACTORIES
// ============================================================================

export function createMockSession(overrides?: MockSessionOverrides): MketySession {
  const defaultUser: MketySessionUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
    roles: { 'test-tenant': 'member' },
    permissions: {},
  };

  return {
    user: {
      ...defaultUser,
      ...overrides?.user,
    },
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 86_400_000),
  };
}

export function createMockAdminSession(overrides?: MockSessionOverrides): MketySession {
  return createMockSession({
    ...overrides,
    user: {
      roles: { 'test-tenant': 'admin' },
      ...overrides?.user,
    },
  });
}

export function createMockManagerSession(overrides?: MockSessionOverrides): MketySession {
  return createMockSession({
    ...overrides,
    user: {
      roles: { 'test-tenant': 'manager' },
      ...overrides?.user,
    },
  });
}

export function createNullAuthResult(): AuthResult {
  return null;
}

// ============================================================================
// AUTH MOCK HELPERS
// ============================================================================

export function createTypedAuthMock() {
  const mockFn = jest.fn<Promise<AuthResult>, []>();

  return {
    mock: mockFn,
    mockAuthenticated: (overrides?: MockSessionOverrides) => {
      mockFn.mockResolvedValue(createMockSession(overrides));
    },
    mockUnauthenticated: () => {
      mockFn.mockResolvedValue(null);
    },
    mockAdmin: (overrides?: MockSessionOverrides) => {
      mockFn.mockResolvedValue(createMockAdminSession(overrides));
    },
    mockManager: (overrides?: MockSessionOverrides) => {
      mockFn.mockResolvedValue(createMockManagerSession(overrides));
    },
    mockError: (error: Error) => {
      mockFn.mockRejectedValue(error);
    },
    reset: () => {
      mockFn.mockReset();
    },
    clear: () => {
      mockFn.mockClear();
    },
  };
}

// ============================================================================
// TENANT MOCK FACTORIES
// ============================================================================

export function createMockTenant(overrides?: MockTenantOverrides): MockTenant {
  return {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    description: null,
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTypedTenantMock() {
  const mockFn = jest.fn<Promise<MockTenant | undefined>, [string]>();

  return {
    mock: mockFn,
    mockFound: (overrides?: MockTenantOverrides) => {
      mockFn.mockResolvedValue(createMockTenant(overrides));
    },
    mockNotFound: () => {
      mockFn.mockResolvedValue(undefined);
    },
    reset: () => {
      mockFn.mockReset();
    },
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSession(value: AuthResult): value is MketySession {
  return value !== null && typeof value === 'object' && 'user' in value && 'expiresAt' in value;
}

export function hasEmail(session: MketySession): session is MketySession & { user: MketySessionUser & { email: string } } {
  return typeof session.user.email === 'string';
}

export function hasRole(session: MketySession, tenantSlug: string, role: TenantRole): boolean {
  return session.user.roles[tenantSlug] === role;
}

// ============================================================================
// PERSON MOCK FACTORIES
// ============================================================================

export interface MockPersonSummary {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  title: string | null;
}

export interface MockPersonWithDepth extends MockPersonSummary {
  department: string | null;
  depth: number;
  path: string[];
}

export function createMockPersonSummary(overrides?: Partial<MockPersonSummary>): MockPersonSummary {
  return {
    id: 'person-123',
    displayName: 'Test Person',
    email: 'person@example.com',
    avatarUrl: null,
    title: null,
    ...overrides,
  };
}

export function createMockPersonWithDepth(overrides?: Partial<MockPersonWithDepth>): MockPersonWithDepth {
  return {
    ...createMockPersonSummary(overrides),
    department: null,
    depth: 0,
    path: [],
    ...overrides,
  };
}
