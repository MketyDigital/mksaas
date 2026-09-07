/** @jest-environment node */

import { type BillingSummaryRouteDependencies, createBillingSummaryHandler } from './route';

const summary = {
  plan: { key: 'pro', name: 'Pro', version: 3 },
  subscription: { status: 'active' as const, renewalMode: 'manual' as const, autoRenew: false, gracePeriodEnd: null },
  currentPeriod: {
    start: new Date('2026-09-01T00:00:00.000Z'),
    end: new Date('2026-10-01T00:00:00.000Z'),
    amountDueMinor: 1999n,
    currency: 'USD',
  },
  recentLedger: [],
  recentSettlements: [],
};

function makeDependencies(options?: { userId?: string | null; membership?: boolean; hasSummary?: boolean }) {
  const getTenantBillingSummary = jest.fn(async () => (options?.hasSummary === false ? null : summary));
  const dependencies: BillingSummaryRouteDependencies = {
    async getCurrentUserId() {
      return options?.userId === undefined ? 'user-1' : options.userId;
    },
    async findCurrentMembership(tenantSlug, userId) {
      return options?.membership === false || tenantSlug !== 'acme' || userId !== 'user-1'
        ? null
        : { tenantId: 'tenant-1' };
    },
    getTenantBillingSummary,
  };
  return { dependencies, getTenantBillingSummary };
}

describe('tenant billing summary route', () => {
  it('returns 401 when there is no current Mkety user session', async () => {
    const { dependencies } = makeDependencies({ userId: null });
    const response = await createBillingSummaryHandler(dependencies)(new Request('https://mkety.test'), {
      params: Promise.resolve({ tenant: 'acme' }),
    });
    expect(response.status).toBe(401);
  });

  it('fails closed for a user without current DB membership in the requested tenant', async () => {
    const { dependencies, getTenantBillingSummary } = makeDependencies({ membership: false });
    const response = await createBillingSummaryHandler(dependencies)(new Request('https://mkety.test'), {
      params: Promise.resolve({ tenant: 'acme' }),
    });
    expect(response.status).toBe(403);
    expect(getTenantBillingSummary).not.toHaveBeenCalled();
  });

  it('returns exact minor units as JSON-safe decimal strings for an authorized tenant member', async () => {
    const { dependencies } = makeDependencies();
    const response = await createBillingSummaryHandler(dependencies)(new Request('https://mkety.test'), {
      params: Promise.resolve({ tenant: 'acme' }),
    });
    const body = (await response.json()) as { currentPeriod: { amountDueMinor: string } };

    expect(response.status).toBe(200);
    expect(body.currentPeriod.amountDueMinor).toBe('1999');
    expect(JSON.stringify(body)).not.toContain('providerCustomerRef');
    expect(JSON.stringify(body)).not.toContain('rawReference');
  });

  it('returns 404 when an authorized tenant has no billing state yet', async () => {
    const { dependencies } = makeDependencies({ hasSummary: false });
    const response = await createBillingSummaryHandler(dependencies)(new Request('https://mkety.test'), {
      params: Promise.resolve({ tenant: 'acme' }),
    });
    expect(response.status).toBe(404);
  });
});
