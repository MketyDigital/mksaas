import type { RenewalMode, SubscriptionStatus } from '../domain/types';

export interface BillingCurrentStateRecord {
  planKey: string;
  planName: string;
  planVersion: number;
  amountDueMinor: bigint;
  currency: string;
  subscriptionStatus: SubscriptionStatus;
  renewalMode: RenewalMode;
  autoRenew: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEnd: Date | null;
  providerCustomerRef?: string | null;
  providerSubscriptionRef?: string | null;
}

export interface BillingLedgerSummaryRecord {
  id: string;
  entryType: string;
  amountMinor: bigint;
  currency: string;
  createdAt: Date;
  reference?: string | null;
}

export interface BillingSettlementSummaryRecord {
  id: string;
  provider: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  status: string;
  occurredAt: Date;
  rawReference?: string | null;
}

export interface BillingSummarySource {
  getCurrentBillingState(tenantId: string): Promise<BillingCurrentStateRecord | null>;
  getRecentLedgerEntries(tenantId: string): Promise<BillingLedgerSummaryRecord[]>;
  getRecentSettlements(tenantId: string): Promise<BillingSettlementSummaryRecord[]>;
}

export interface TenantBillingSummary {
  plan: {
    key: string;
    name: string;
    version: number;
  };
  subscription: {
    status: SubscriptionStatus;
    renewalMode: RenewalMode;
    autoRenew: boolean;
    gracePeriodEnd: Date | null;
  };
  currentPeriod: {
    start: Date | null;
    end: Date | null;
    amountDueMinor: bigint;
    currency: string;
  };
  recentLedger: Array<{
    id: string;
    entryType: string;
    amountMinor: bigint;
    currency: string;
    createdAt: Date;
  }>;
  recentSettlements: Array<{
    id: string;
    provider: string;
    amountPaidMinor: bigint;
    currencyPaid: string;
    status: string;
    occurredAt: Date;
  }>;
}

export async function getTenantBillingSummary(
  source: BillingSummarySource,
  tenantId: string,
): Promise<TenantBillingSummary | null> {
  const current = await source.getCurrentBillingState(tenantId);
  if (!current) return null;

  const [ledger, settlements] = await Promise.all([
    source.getRecentLedgerEntries(tenantId),
    source.getRecentSettlements(tenantId),
  ]);

  return {
    plan: {
      key: current.planKey,
      name: current.planName,
      version: current.planVersion,
    },
    subscription: {
      status: current.subscriptionStatus,
      renewalMode: current.renewalMode,
      autoRenew: current.autoRenew,
      gracePeriodEnd: current.gracePeriodEnd,
    },
    currentPeriod: {
      start: current.currentPeriodStart,
      end: current.currentPeriodEnd,
      amountDueMinor: current.amountDueMinor,
      currency: current.currency,
    },
    recentLedger: ledger.map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
      createdAt: entry.createdAt,
    })),
    recentSettlements: settlements.map((settlement) => ({
      id: settlement.id,
      provider: settlement.provider,
      amountPaidMinor: settlement.amountPaidMinor,
      currencyPaid: settlement.currencyPaid,
      status: settlement.status,
      occurredAt: settlement.occurredAt,
    })),
  };
}
