export type ManualAdjustmentType = 'payment' | 'waiver' | 'credit' | 'debit';

export interface ManualAdjustmentInput {
  tenantId: string;
  tenantSlug: string;
  subscriptionId: string | null;
  billingPeriodId: string | null;
  idempotencyKey: string;
  adjustmentType: ManualAdjustmentType;
  amountMinor: bigint;
  currency: string;
  reason: string;
  reference?: string | null;
}

export interface ManualAdjustmentActor {
  userId: string;
}

export interface ManualAdjustmentCommand extends ManualAdjustmentInput {
  actorUserId: string;
  source: 'manual';
}

export interface ManualAdjustmentResult {
  adjustmentId: string;
  applied: boolean;
}

export interface ManualAdjustmentDependencies {
  canManageBilling(tenantSlug: string, userId: string): Promise<boolean>;
  applyAtomically(command: ManualAdjustmentCommand): Promise<ManualAdjustmentResult>;
}

const NORMALIZED_CURRENCY_CODE = /^[A-Z]{3}$/;

export async function applyManualAdjustment(
  dependencies: ManualAdjustmentDependencies,
  input: ManualAdjustmentInput,
  actor: ManualAdjustmentActor,
): Promise<ManualAdjustmentResult> {
  if (!(await dependencies.canManageBilling(input.tenantSlug, actor.userId))) {
    throw new Error('Actor is not authorized to manage billing for this tenant.');
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Manual adjustment reason is required.');
  }

  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new Error('Manual adjustment idempotency key is required.');
  }

  if (!NORMALIZED_CURRENCY_CODE.test(input.currency)) {
    throw new Error('Manual adjustment currency must be a normalized ISO-style currency code.');
  }

  if (input.amountMinor === 0n) {
    throw new Error('Manual adjustment amount cannot be zero.');
  }

  return dependencies.applyAtomically({
    ...input,
    idempotencyKey,
    reason,
    actorUserId: actor.userId,
    source: 'manual',
  });
}
