import type { CreditLedgerRecord, NewCreditLedgerRecord, NewStoredUsageRecord, StoredUsageRecord } from './source';
import type { CreditBalance } from '../types';

export type StoredAiCreditReservationStatus = 'held' | 'settled' | 'released';

export interface StoredAiCreditReservation {
  id: string;
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  requestId: string | null;
  idempotencyKey: string;
  fingerprint: string;
  status: StoredAiCreditReservationStatus;
  reservedCredits: bigint;
  settledCredits: bigint | null;
  holdLedgerEntryId: string | null;
  releaseLedgerEntryId: string | null;
  usageEventId: string | null;
  expiresAt: Date;
  settledAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewStoredAiCreditReservation = Omit<
  StoredAiCreditReservation,
  | 'id'
  | 'settledCredits'
  | 'releaseLedgerEntryId'
  | 'usageEventId'
  | 'settledAt'
  | 'releasedAt'
  | 'releaseReason'
  | 'createdAt'
  | 'updatedAt'
> & {
  settledCredits?: bigint | null;
  releaseLedgerEntryId?: string | null;
  usageEventId?: string | null;
  settledAt?: Date | null;
  releasedAt?: Date | null;
  releaseReason?: string | null;
};

export interface AiReservationOwnedScope {
  projectId: string | null;
  apiKeyId: string | null;
  requestId: string | null;
}

export interface AiCreditReservationTransaction {
  findReservationByIdempotency(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<StoredAiCreditReservation | null>;
  getReservation(tenantId: string, reservationId: string): Promise<StoredAiCreditReservation | null>;
  validateOwnedScope(tenantId: string, scope: AiReservationOwnedScope): Promise<boolean>;
  getCreditBalance(tenantId: string): Promise<CreditBalance | null>;
  applyReservationHold(tenantId: string, credits: bigint): Promise<CreditBalance | null>;
  applyReservationSettlement(
    tenantId: string,
    reservedCredits: bigint,
    actualCredits: bigint,
  ): Promise<CreditBalance | null>;
  applyReservationRelease(tenantId: string, reservedCredits: bigint): Promise<CreditBalance | null>;
  insertReservation(input: NewStoredAiCreditReservation): Promise<StoredAiCreditReservation>;
  claimSettlement(
    tenantId: string,
    reservationId: string,
    actualCredits: bigint,
    settledAt: Date,
  ): Promise<StoredAiCreditReservation | null>;
  claimRelease(
    tenantId: string,
    reservationId: string,
    reason: string,
    releasedAt: Date,
  ): Promise<StoredAiCreditReservation | null>;
  finalizeSettlementLinks(input: {
    tenantId: string;
    reservationId: string;
    releaseLedgerEntryId: string;
    usageEventId: string;
  }): Promise<StoredAiCreditReservation>;
  finalizeReleaseLink(input: {
    tenantId: string;
    reservationId: string;
    releaseLedgerEntryId: string;
  }): Promise<StoredAiCreditReservation>;
  insertUsage(input: NewStoredUsageRecord): Promise<StoredUsageRecord>;
  insertLedger(input: NewCreditLedgerRecord): Promise<CreditLedgerRecord>;
}

export interface AiCreditReservationSource {
  transaction<T>(work: (tx: AiCreditReservationTransaction) => Promise<T>): Promise<T>;
}
