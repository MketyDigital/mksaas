import type { GrantCreditsInput } from '../types';
import {
  createPeriodGrantService,
  type BillingCreditAllowanceState,
  type BillingCreditAllowanceSource,
} from './period-grants';

class FakeAllowanceSource implements BillingCreditAllowanceSource {
  constructor(private readonly states: Map<string, BillingCreditAllowanceState | null>) {}

  async getCurrentBillingCreditAllowance(tenantId: string) {
    return this.states.get(tenantId) ?? null;
  }
}

describe('billing-period recurring credit grants', () => {
  it('grants the current plan-version allowance with deterministic period idempotency', async () => {
    const grantCredits = jest.fn(async (input: GrantCreditsInput) => ({
      balance: {
        tenantId: input.tenantId,
        availableCredits: input.credits,
        lifetimeGranted: input.credits,
        lifetimeConsumed: 0n,
      },
      ledgerEntryId: 'ledger-1',
    }));
    const service = createPeriodGrantService(
      new FakeAllowanceSource(
        new Map([
          [
            'tenant-a',
            {
              billingPeriodId: 'period-1',
              planVersionId: 'plan-version-1',
              allowanceId: 'allowance-1',
              credits: 1000n,
            },
          ],
        ]),
      ),
      { grantCredits },
    );

    await service.grantCurrentPeriodAllowance('tenant-a');

    expect(grantCredits).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      credits: 1000n,
      idempotencyKey: 'billing-period:period-1:credit-allowance:allowance-1',
      entryType: 'period_grant',
      source: 'billing_period_allowance',
      billingPeriodId: 'period-1',
      reason: 'Recurring plan-version credit allowance.',
    });
  });

  it('returns null without mutating credits when no qualifying billing allowance exists', async () => {
    const grantCredits = jest.fn();
    const service = createPeriodGrantService(
      new FakeAllowanceSource(new Map([['tenant-a', null]])),
      { grantCredits },
    );

    await expect(service.grantCurrentPeriodAllowance('tenant-a')).resolves.toBeNull();
    expect(grantCredits).not.toHaveBeenCalled();
  });

  it('keeps tenant scope when resolving the same plan allowance for another tenant', async () => {
    const grantCredits = jest.fn(async (input: GrantCreditsInput) => ({
      balance: {
        tenantId: input.tenantId,
        availableCredits: input.credits,
        lifetimeGranted: input.credits,
        lifetimeConsumed: 0n,
      },
      ledgerEntryId: `${input.tenantId}-ledger`,
    }));
    const source = new FakeAllowanceSource(
      new Map([
        ['tenant-a', { billingPeriodId: 'period-a', planVersionId: 'pv-1', allowanceId: 'allowance-1', credits: 50n }],
        ['tenant-b', { billingPeriodId: 'period-b', planVersionId: 'pv-1', allowanceId: 'allowance-1', credits: 50n }],
      ]),
    );
    const service = createPeriodGrantService(source, { grantCredits });

    await service.grantCurrentPeriodAllowance('tenant-b');

    expect(grantCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-b',
        billingPeriodId: 'period-b',
        idempotencyKey: 'billing-period:period-b:credit-allowance:allowance-1',
      }),
    );
  });
});
