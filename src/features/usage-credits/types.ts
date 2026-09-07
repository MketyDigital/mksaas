import type { UsageMeterKey } from './meter-keys';

export const USAGE_CREDIT_ERROR_CODES = {
  idempotencyConflict: 'USAGE_CREDIT_IDEMPOTENCY_CONFLICT',
  insufficientCredits: 'USAGE_CREDIT_INSUFFICIENT_CREDITS',
  invalidAmount: 'USAGE_CREDIT_INVALID_AMOUNT',
  missingAccount: 'USAGE_CREDIT_MISSING_ACCOUNT',
  unknownMeter: 'USAGE_CREDIT_UNKNOWN_METER',
} as const;

export type UsageCreditErrorCode =
  (typeof USAGE_CREDIT_ERROR_CODES)[keyof typeof USAGE_CREDIT_ERROR_CODES];

export class UsageCreditError extends Error {
  readonly code: UsageCreditErrorCode;

  constructor(code: UsageCreditErrorCode, message: string) {
    super(message);
    this.name = 'UsageCreditError';
    this.code = code;
  }
}

export interface CreditBalance {
  tenantId: string;
  availableCredits: bigint;
  lifetimeGranted: bigint;
  lifetimeConsumed: bigint;
}

export interface GrantCreditsInput {
  tenantId: string;
  credits: bigint;
  idempotencyKey: string;
  entryType: 'period_grant' | 'manual_grant' | 'adjustment';
  source: string;
  billingPeriodId?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
}

export interface ConsumeCreditsInput {
  tenantId: string;
  meter: UsageMeterKey;
  quantity: bigint;
  credits: bigint;
  idempotencyKey: string;
  source: string;
  projectId?: string | null;
  workspaceKey?: string | null;
  occurredAt?: Date;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  meter: UsageMeterKey;
  quantity: bigint;
  creditsCharged: bigint;
  idempotencyKey: string;
  occurredAt: Date;
}

export interface CreditMutationResult {
  balance: CreditBalance;
  ledgerEntryId: string;
  usage?: UsageRecord;
}
