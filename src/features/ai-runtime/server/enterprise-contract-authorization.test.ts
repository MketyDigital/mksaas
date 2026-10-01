/** @jest-environment node */
import { saveMediaTenantLink } from '@/features/media/server/links';
import { createEnterpriseAiContractVersion } from './enterprise-contracts';

let mockEmail = 'customer@example.com';
let mockPermissionDenied = false;
let mockTargetLookups = 0;
jest.mock('@/shared/lib/permissions', () => ({
  requirePermission: async () => {
    if (mockPermissionDenied) throw new Error('permission_denied');
    return { email: mockEmail, userId: 'actor' };
  },
}));
jest.mock('@/shared/lib/tenant', () => ({
  getTenantBySlug: async () => {
    mockTargetLookups += 1;
    throw new Error('target_lookup_started');
  },
}));
jest.mock('@/shared/db', () => ({ db: {} }));
jest.mock('@/shared/db/cloudflare', () => ({ db: {} }));
jest.mock('@/shared/db/request', () => ({
  withRequestDatabase: async (work: (database: object) => Promise<unknown>) => work({}),
}));

jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
jest.mock('next/cache', () => ({ revalidatePath: () => {} }));

const form = () => {
  const value = new FormData();
  value.set('targetTenantSlug', 'victim');
  value.set('externalWorkspaceRef', 'victim-media');
  return value;
};

describe.each([
  ['Enterprise contract', createEnterpriseAiContractVersion],
  ['Media link', saveMediaTenantLink],
] as const)('%s global authorization', (_name, action) => {
  beforeEach(() => {
    process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG = 'mkety-ops';
    process.env.MKETY_PLATFORM_ADMIN_EMAILS = 'operator@example.com';
    mockEmail = 'customer@example.com';
    mockPermissionDenied = false;
    mockTargetLookups = 0;
  });
  afterEach(() => {
    delete process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG;
    delete process.env.MKETY_PLATFORM_ADMIN_EMAILS;
  });
  it('denies a customer admin direct action before looking up another tenant', async () => {
    await expect(action('customer', form())).rejects.toThrow('unauthorized');
    expect(mockTargetLookups).toBe(0);
  });
  it('denies an unapproved email even in the reserved tenant', async () => {
    await expect(action('mkety-ops', form())).rejects.toThrow('unauthorized');
    expect(mockTargetLookups).toBe(0);
  });
  it('requires PBAC in addition to tenant and operator identity', async () => {
    mockEmail = 'operator@example.com';
    mockPermissionDenied = true;
    await expect(action('mkety-ops', form())).rejects.toThrow('permission_denied');
    expect(mockTargetLookups).toBe(0);
  });
  it('allows the approved platform operator to enter target validation', async () => {
    mockEmail = 'operator@example.com';
    await expect(action('mkety-ops', form())).rejects.toThrow('target_lookup_started');
    expect(mockTargetLookups).toBe(1);
  });
});
