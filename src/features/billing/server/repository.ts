import type { NormalizedSettlement } from '../domain/settlement';

export interface AppliedSettlementResult {
  settlementId: string;
  applied: boolean;
}

export interface BillingRepository {
  /**
   * Atomically inserts/applies a verified settlement or returns the already
   * applied settlement when a provider replay hits an idempotency constraint.
   * Implementations must keep settlement, ledger, period and subscription
   * mutation inside one database transaction.
   */
  applyVerifiedSettlementAtomically(
    input: NormalizedSettlement,
    appliedAt: Date,
  ): Promise<AppliedSettlementResult>;
}
