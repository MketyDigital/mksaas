export type AiBudgetReservationStatus = 'held' | 'settled' | 'released';

export interface StoredAiBudget {
  id: string;
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  maxCredits: bigint | null;
  maxRequests: bigint | null;
  usedCredits: bigint;
  usedRequests: bigint;
  reservedCredits: bigint;
  reservedRequests: bigint;
  hardStop: boolean;
  startsAt: Date;
  endsAt: Date;
}

export interface StoredAiBudgetReservation {
  id: string;
  tenantId: string;
  budgetId: string;
  requestId: string | null;
  creditReservationId: string | null;
  idempotencyKey: string;
  fingerprint: string;
  status: AiBudgetReservationStatus;
  reservedCredits: bigint;
  reservedRequests: bigint;
  settledCredits: bigint | null;
  settledRequests: bigint | null;
  expiresAt: Date;
  settledAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewStoredAiBudgetReservation = Omit<
  StoredAiBudgetReservation,
  | 'id'
  | 'settledCredits'
  | 'settledRequests'
  | 'settledAt'
  | 'releasedAt'
  | 'releaseReason'
  | 'createdAt'
  | 'updatedAt'
> & {
  settledCredits?: bigint | null;
  settledRequests?: bigint | null;
  settledAt?: Date | null;
  releasedAt?: Date | null;
  releaseReason?: string | null;
};

export interface AiBudgetReservationTransaction {
  listApplicableBudgets(input: {
    tenantId: string;
    projectId: string | null;
    apiKeyId: string | null;
    now: Date;
  }): Promise<StoredAiBudget[]>;
  findReservationsByIdempotency(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<StoredAiBudgetReservation[]>;
  getReservations(
    tenantId: string,
    reservationIds: string[],
  ): Promise<StoredAiBudgetReservation[]>;
  applyBudgetHold(
    budgetId: string,
    credits: bigint,
    requests: bigint,
  ): Promise<StoredAiBudget | null>;
  applyBudgetSettlement(
    budgetId: string,
    reservedCredits: bigint,
    reservedRequests: bigint,
    actualCredits: bigint,
    actualRequests: bigint,
  ): Promise<StoredAiBudget | null>;
  applyBudgetRelease(
    budgetId: string,
    reservedCredits: bigint,
    reservedRequests: bigint,
  ): Promise<StoredAiBudget | null>;
  insertReservation(
    input: NewStoredAiBudgetReservation,
  ): Promise<StoredAiBudgetReservation>;
  claimSettlement(input: {
    tenantId: string;
    reservationId: string;
    actualCredits: bigint;
    actualRequests: bigint;
    settledAt: Date;
  }): Promise<StoredAiBudgetReservation | null>;
  claimRelease(input: {
    tenantId: string;
    reservationId: string;
    reason: string;
    releasedAt: Date;
  }): Promise<StoredAiBudgetReservation | null>;
}

export interface AiBudgetReservationSource {
  transaction<T>(work: (tx: AiBudgetReservationTransaction) => Promise<T>): Promise<T>;
}
