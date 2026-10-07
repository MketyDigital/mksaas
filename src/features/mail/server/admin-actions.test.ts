jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('drizzle-orm', () => ({
  and: jest.fn((...values) => values),
  desc: jest.fn((value) => value),
  eq: jest.fn((...values) => values),
  gt: jest.fn((...values) => values),
  inArray: jest.fn((...values) => values),
  isNotNull: jest.fn((value) => value),
  isNull: jest.fn((value) => value),
  lte: jest.fn((...values) => values),
  or: jest.fn((...values) => values),
  sql: jest.fn(),
}));
jest.mock('@/features/billing/server/catalog-seed', () => ({ seedSelfServiceBillingCatalog: jest.fn() }));
jest.mock('@/features/enterprise-checkout/server/service', () => ({ enterpriseCheckoutService: {} }));
jest.mock('@/features/enterprise-checkout/domain', () => ({
  formatUsdMinorUnits: jest.fn(),
  parseUsdAmountToMinorUnits: jest.fn(),
}));
jest.mock('@/features/entitlements/server/resolver', () => ({ hasEntitlement: jest.fn() }));
jest.mock('@/features/mail/server/first-party-smtp-credential', () => ({
  createFirstPartySmtpCredentialRecord: jest.fn(),
}));
jest.mock('@/features/mail/server/platform-sender', () => ({ sendPlatformMail: jest.fn() }));
jest.mock('@/features/platform-content/server/authorization', () => ({
  requirePlatformControlAccess: jest.fn(),
}));
jest.mock('@/shared/db/server-action', () => ({ withServerActionDatabase: jest.fn() }));
jest.mock('@/shared/db', () => ({ db: { transaction: jest.fn() } }));
jest.mock('@/shared/db/platform-control-mutation', () => ({
  runPlatformControlMutation: jest.fn(({ work }) => work()),
}));
jest.mock('@/shared/db/schema', () => ({
  tenants: { id: 'tenants.id', slug: 'tenants.slug' },
  tenantEntitlementOverrides: {
    id: 'overrides.id',
    tenantId: 'overrides.tenantId',
    entitlementKey: 'overrides.entitlementKey',
    effect: 'overrides.effect',
    expiresAt: 'overrides.expiresAt',
  },
  mailWorkspaces: { id: 'workspaces.id', tenantId: 'workspaces.tenantId', status: 'workspaces.status' },
}));
jest.mock('@/shared/lib/permissions', () => ({ requirePermission: jest.fn() }));
jest.mock('@/shared/services/audit-service', () => ({ logAuditEvent: jest.fn() }));
jest.mock('./runtime-config', () => ({ getFirstPartyMailTenantId: jest.fn(() => 'reserved-tenant') }));
jest.mock('./commercial', () => ({ MAIL_INTERNAL_CUSTOM_PROFILE_KEY: 'mail-internal-custom' }));
jest.mock('../commercial/plans', () => ({ isMailPlanKey: jest.fn() }));
jest.mock('../commercial/enterprise-offers', () => ({ parseMailEnterpriseOfferInput: jest.fn() }));

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db';
import { tenantEntitlementOverrides, mailWorkspaces, tenants } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';

import { bootstrapFirstPartyMailWorkspace } from './admin-actions';

const mockRequireAccess = requirePlatformControlAccess as jest.MockedFunction<typeof requirePlatformControlAccess>;
const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;
const mockAudit = logAuditEvent as jest.MockedFunction<typeof logAuditEvent>;
const mockTransaction = db.transaction as jest.Mock;

describe('first-party Mail workspace bootstrap', () => {
  let grantExists: boolean;
  let denyExists: boolean;
  let workspace: Record<string, unknown> | null;
  let insertedGrants: Array<Record<string, unknown>>;
  let insertedWorkspaces: Array<Record<string, unknown>>;
  let workspaceUpdates: Array<Record<string, unknown>>;
  let overrideReads: number;
  let tx: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    grantExists = false;
    denyExists = false;
    workspace = null;
    insertedGrants = [];
    insertedWorkspaces = [];
    workspaceUpdates = [];
    overrideReads = 0;
    mockRequireAccess.mockResolvedValue({ userId: 'operator-1', email: 'operator@mkety.com' } as never);
    mockRequirePermission.mockResolvedValue(undefined as never);

    const selectQuery = () => {
      let table: unknown;
      const query: Record<string, unknown> = {
        from: (selectedTable: unknown) => {
          table = selectedTable;
          return query;
        },
        where: () => query,
        for: () => query,
        limit: async () => {
          if (table === tenants) return [{ id: 'reserved-tenant', slug: 'mkety-ops' }];
          if (table === tenantEntitlementOverrides) {
            overrideReads += 1;
            if (denyExists && overrideReads === 1) return [{ id: 'deny-1' }];
            if (grantExists && overrideReads === 2) return [{ id: 'grant-1' }];
            return [];
          }
          if (table === mailWorkspaces) return workspace ? [workspace] : [];
          return [];
        },
      };
      return query;
    };

    tx = {
      select: jest.fn(() => selectQuery()),
      insert: jest.fn((table: unknown) => ({
        values: jest.fn((values: Record<string, unknown>) => {
          if (table === tenantEntitlementOverrides) {
            insertedGrants.push(values);
            grantExists = true;
            return Promise.resolve();
          }
          if (table === mailWorkspaces) {
            workspace = { id: 'workspace-1', ...values };
            insertedWorkspaces.push(values);
            return { returning: async () => [workspace] };
          }
          throw new Error('Unexpected insert table');
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: jest.fn((values: Record<string, unknown>) => ({
          where: jest.fn(() => ({
            returning: async () => {
              if (table !== mailWorkspaces || !workspace) throw new Error('Unexpected workspace update');
              workspaceUpdates.push(values);
              workspace = { ...workspace, ...values };
              return [workspace];
            },
          })),
        })),
      })),
    };

    mockTransaction.mockImplementation(async (work: (transaction: unknown) => Promise<unknown>) => work(tx));
  });

  it('creates the internal grant and workspace and records who provisioned them', async () => {
    await bootstrapFirstPartyMailWorkspace('mkety');

    expect(insertedGrants).toEqual([
      expect.objectContaining({
        tenantId: 'reserved-tenant',
        entitlementKey: 'workspace.mail',
        effect: 'grant',
        source: 'mail:first-party-internal',
        actorUserId: 'operator-1',
      }),
    ]);
    expect(insertedWorkspaces).toEqual([
      expect.objectContaining({
        tenantId: 'reserved-tenant',
        status: 'active',
        planKey: 'mail-internal-custom',
        enabledByUserId: 'operator-1',
      }),
    ]);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'operator-1',
      action: 'mail.first_party_workspace.bootstrapped',
      metadata: expect.objectContaining({ tenantId: 'reserved-tenant', tenantSlug: 'mkety-ops' }),
    }));
  });

  it('does not write or re-audit when the internal workspace is provisioned already', async () => {
    grantExists = true;
    workspace = {
      id: 'workspace-1',
      tenantId: 'reserved-tenant',
      status: 'active',
      planKey: 'mail-internal-custom',
    };

    await bootstrapFirstPartyMailWorkspace('mkety');

    expect(insertedGrants).toHaveLength(0);
    expect(insertedWorkspaces).toHaveLength(0);
    expect(workspaceUpdates).toHaveLength(0);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('does not grant or create a workspace when Mail is explicitly denied', async () => {
    denyExists = true;

    await expect(bootstrapFirstPartyMailWorkspace('mkety')).rejects.toThrow(
      'Mail is explicitly denied for the reserved tenant',
    );

    expect(insertedGrants).toHaveLength(0);
    expect(insertedWorkspaces).toHaveLength(0);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
