import type { CreditMutationResult, GrantCreditsInput } from '../types';

export interface BillingCreditAllowanceState {
  billingPeriodId: string;
  planVersionId: string;
  allowanceId: string;
  credits: bigint;
}

export interface BillingCreditAllowanceSource {
  getCurrentBillingCreditAllowance(tenantId: string): Promise<BillingCreditAllowanceState | null>;
}

interface CreditGrantService {
  grantCredits(input: GrantCreditsInput): Promise<CreditMutationResult>;
}

export function createPeriodGrantService(
  source: BillingCreditAllowanceSource,
  creditService: CreditGrantService,
) {
  return {
    async grantCurrentPeriodAllowance(tenantId: string): Promise<CreditMutationResult | null> {
      const allowance = await source.getCurrentBillingCreditAllowance(tenantId);
      if (!allowance) return null;

      return creditService.grantCredits({
        tenantId,
        credits: allowance.credits,
        idempotencyKey: `billing-period:${allowance.billingPeriodId}:credit-allowance:${allowance.allowanceId}`,
        entryType: 'period_grant',
        source: 'billing_period_allowance',
        billingPeriodId: allowance.billingPeriodId,
        reason: 'Recurring plan-version credit allowance.',
      });
    },
  };
}

let defaultPeriodGrantServicePromise: Promise<ReturnType<typeof createPeriodGrantService>> | null = null;

function getDefaultPeriodGrantService() {
  defaultPeriodGrantServicePromise ??= Promise.all([
    import('./drizzle-source'),
    import('./service'),
  ]).then(([{ drizzleBillingCreditAllowanceSource }, { grantCredits }]) =>
    createPeriodGrantService(drizzleBillingCreditAllowanceSource, { grantCredits }),
  );
  return defaultPeriodGrantServicePromise;
}

export async function grantCurrentPeriodAllowance(tenantId: string) {
  return (await getDefaultPeriodGrantService()).grantCurrentPeriodAllowance(tenantId);
}
