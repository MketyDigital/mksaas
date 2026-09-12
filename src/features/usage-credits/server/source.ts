import type { UsageMeterKey } from '../meter-keys';
import type { CreditBalance } from '../types';

export type CreditLedgerEntryType =
  | 'period_grant'
  | 'usage'
  | 'manual_grant'
  | 'manual_debit'
  | 'adjustment';

export interface CreditLedgerRecord {
  id: string;
  tenantId: string;
  delta: bigint;
  entryType: CreditLedgerEntryType;
  source: string;
  billingPeriodId: string | null;
  usageEventId: string | null;
  idempotencyKey: string;
  reason: string | null;
  actorUserId: string | null;
}

export interface StoredUsageRecord {
  id: string;
  tenantId: string;
  meterKey: UsageMeterKey;
  quantity: bigint;
  creditsCharged: bigint;
  idempotencyKey: string;
  projectId: string | null;
  workspaceKey: string | null;
  source: string;
  occurredAt: Date;
}

export type NewCreditLedgerRecord = Omit<CreditLedgerRecord, 'id'>;
export type NewStoredUsageRecord = Omit<StoredUsageRecord, 'id'>;

export interface UsageCreditTransaction {
  findLedgerByIdempotency(tenantId: string, idempotencyKey: string): Promise<CreditLedgerRecord | null>;
  findUsageByIdempotency(tenantId: string, idempotencyKey: string): Promise<StoredUsageRecord | null>;
  getCreditBalance(tenantId: string): Promise<CreditBalance | null>;
  applyGrant(tenantId: string, credits: bigint): Promise<CreditBalance>;
  applyDebit(tenantId: string, credits: bigint): Promise<CreditBalance | null>;
  insertUsage(input: NewStoredUsageRecord): Promise<StoredUsageRecord>;
  insertLedger(input: NewCreditLedgerRecord): Promise<CreditLedgerRecord>;
}

export interface UsageCreditSource {
  transaction<T>(work: (tx: UsageCreditTransaction) => Promise<T>): Promise<T>;
  getCreditBalance(tenantId: string): Promise<CreditBalance | null>;
  getTenantUsage(tenantId: string): Promise<StoredUsageRecord[]>;
  getCreditLedger(tenantId: string): Promise<CreditLedgerRecord[]>;
}
