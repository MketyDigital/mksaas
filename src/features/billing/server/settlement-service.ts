import { assertApplicableSettlement, type NormalizedSettlement } from '../domain/settlement';
import type { BillingRepository } from './repository';

export type SettlementApplicationResult =
  | { status: 'applied'; settlementId: string }
  | { status: 'duplicate'; settlementId: string };

export async function applyVerifiedSettlement(
  repository: BillingRepository,
  input: NormalizedSettlement,
  appliedAt: Date = new Date(),
): Promise<SettlementApplicationResult> {
  assertApplicableSettlement(input);

  if (!input.providerEventId && !input.providerPaymentId) {
    throw new Error('Verified gateway settlement requires a provider event or payment ID.');
  }

  const result = await repository.applyVerifiedSettlementAtomically(input, appliedAt);
  return {
    status: result.applied ? 'applied' : 'duplicate',
    settlementId: result.settlementId,
  };
}
