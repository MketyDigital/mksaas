import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  aiApiKeys,
  type AiCreditReservation,
  aiCreditReservations,
  aiRequests,
} from '@/shared/db/schema/ai-runtime';
import { creditLedgerEntries, type CreditLedgerEntry } from '@/shared/db/schema/credit-ledger-entries';
import { projects } from '@/shared/db/schema/projects';
import {
  type TenantCreditAccount,
  tenantCreditAccounts,
} from '@/shared/db/schema/tenant-credit-accounts';
import { type UsageEvent, usageEvents } from '@/shared/db/schema/usage-events';

import type {
  AiCreditReservationSource,
  AiCreditReservationTransaction,
  StoredAiCreditReservation,
} from './ai-reservation-source';
import type { CreditLedgerRecord, StoredUsageRecord } from './source';
import { isUsageMeterKey } from '../meter-keys';
import {
  type CreditBalance,
  USAGE_CREDIT_ERROR_CODES,
  UsageCreditError,
} from '../types';

function mapBalance(row: TenantCreditAccount): CreditBalance {
  return {
    tenantId: row.tenantId,
    availableCredits: row.availableCredits,
    lifetimeGranted: row.lifetimeGranted,
    lifetimeConsumed: row.lifetimeConsumed,
  };
}

function mapLedger(row: CreditLedgerEntry): CreditLedgerRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    delta: row.delta,
    entryType: row.entryType,
    source: row.source,
    billingPeriodId: row.billingPeriodId,
    usageEventId: row.usageEventId,
    idempotencyKey: row.idempotencyKey,
    reason: row.reason,
    actorUserId: row.actorUserId,
  };
}

function mapUsage(row: UsageEvent): StoredUsageRecord {
  if (!isUsageMeterKey(row.meterKey)) {
    throw new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.unknownMeter,
      'Stored usage contains an unknown meter.',
    );
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    meterKey: row.meterKey,
    quantity: row.quantity,
    creditsCharged: row.creditsCharged,
    idempotencyKey: row.idempotencyKey,
    projectId: row.projectId,
    workspaceKey: row.workspaceKey,
    source: row.source,
    occurredAt: row.occurredAt,
  };
}

function mapReservation(row: AiCreditReservation): StoredAiCreditReservation {
  if (row.status !== 'held' && row.status !== 'settled' && row.status !== 'released') {
    throw new Error(`Unsupported AI credit reservation status: ${row.status}`);
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    apiKeyId: row.apiKeyId,
    requestId: row.requestId,
    idempotencyKey: row.idempotencyKey,
    fingerprint: row.fingerprint,
    status: row.status,
    reservedCredits: row.reservedCredits,
    settledCredits: row.settledCredits,
    holdLedgerEntryId: row.holdLedgerEntryId,
    releaseLedgerEntryId: row.releaseLedgerEntryId,
    usageEventId: row.usageEventId,
    expiresAt: row.expiresAt,
    settledAt: row.settledAt,
    releasedAt: row.releasedAt,
    releaseReason: row.releaseReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const drizzleAiCreditReservationSource: AiCreditReservationSource = {
  transaction<T>(work: (tx: AiCreditReservationTransaction) => Promise<T>): Promise<T> {
    return db.transaction(async (databaseTx) => {
      const tx: AiCreditReservationTransaction = {
        async findReservationByIdempotency(tenantId, idempotencyKey) {
          const [row] = await databaseTx
            .select()
            .from(aiCreditReservations)
            .where(
              and(
                eq(aiCreditReservations.tenantId, tenantId),
                eq(aiCreditReservations.idempotencyKey, idempotencyKey),
              ),
            )
            .limit(1);
          return row ? mapReservation(row) : null;
        },

        async getReservation(tenantId, reservationId) {
          const [row] = await databaseTx
            .select()
            .from(aiCreditReservations)
            .where(
              and(
                eq(aiCreditReservations.tenantId, tenantId),
                eq(aiCreditReservations.id, reservationId),
              ),
            )
            .limit(1);
          return row ? mapReservation(row) : null;
        },

        async validateOwnedScope(tenantId, scope) {
          let projectRow: { id: string } | undefined;
          let apiKeyRow: { id: string; projectId: string | null } | undefined;
          let requestRow:
            | { id: string; projectId: string | null; apiKeyId: string | null }
            | undefined;

          if (scope.projectId) {
            [projectRow] = await databaseTx
              .select({ id: projects.id })
              .from(projects)
              .where(and(eq(projects.id, scope.projectId), eq(projects.tenantId, tenantId)))
              .limit(1);
            if (!projectRow) return false;
          }

          if (scope.apiKeyId) {
            [apiKeyRow] = await databaseTx
              .select({ id: aiApiKeys.id, projectId: aiApiKeys.projectId })
              .from(aiApiKeys)
              .where(and(eq(aiApiKeys.id, scope.apiKeyId), eq(aiApiKeys.tenantId, tenantId)))
              .limit(1);
            if (!apiKeyRow) return false;
            if (scope.projectId && apiKeyRow.projectId && apiKeyRow.projectId !== scope.projectId) {
              return false;
            }
          }

          if (scope.requestId) {
            [requestRow] = await databaseTx
              .select({
                id: aiRequests.id,
                projectId: aiRequests.projectId,
                apiKeyId: aiRequests.apiKeyId,
              })
              .from(aiRequests)
              .where(and(eq(aiRequests.id, scope.requestId), eq(aiRequests.tenantId, tenantId)))
              .limit(1);
            if (!requestRow) return false;
            if (scope.projectId && requestRow.projectId !== scope.projectId) {
              return false;
            }
            if (scope.apiKeyId && requestRow.apiKeyId !== scope.apiKeyId) {
              return false;
            }
            if (
              apiKeyRow?.projectId &&
              requestRow.projectId &&
              apiKeyRow.projectId !== requestRow.projectId
            ) {
              return false;
            }
          }

          return true;
        },

        async getCreditBalance(tenantId) {
          const [row] = await databaseTx
            .select()
            .from(tenantCreditAccounts)
            .where(eq(tenantCreditAccounts.tenantId, tenantId))
            .limit(1);
          return row ? mapBalance(row) : null;
        },

        async applyReservationHold(tenantId, credits) {
          const [row] = await databaseTx
            .update(tenantCreditAccounts)
            .set({
              availableCredits: sql`${tenantCreditAccounts.availableCredits} - ${credits}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(tenantCreditAccounts.tenantId, tenantId),
                sql`${tenantCreditAccounts.availableCredits} >= ${credits}`,
              ),
            )
            .returning();
          return row ? mapBalance(row) : null;
        },

        async applyReservationSettlement(tenantId, reservedCredits, actualCredits) {
          const [row] = await databaseTx
            .update(tenantCreditAccounts)
            .set({
              availableCredits: sql`${tenantCreditAccounts.availableCredits} + ${reservedCredits - actualCredits}`,
              lifetimeConsumed: sql`${tenantCreditAccounts.lifetimeConsumed} + ${actualCredits}`,
              updatedAt: new Date(),
            })
            .where(eq(tenantCreditAccounts.tenantId, tenantId))
            .returning();
          return row ? mapBalance(row) : null;
        },

        async applyReservationRelease(tenantId, reservedCredits) {
          const [row] = await databaseTx
            .update(tenantCreditAccounts)
            .set({
              availableCredits: sql`${tenantCreditAccounts.availableCredits} + ${reservedCredits}`,
              updatedAt: new Date(),
            })
            .where(eq(tenantCreditAccounts.tenantId, tenantId))
            .returning();
          return row ? mapBalance(row) : null;
        },

        async insertReservation(input) {
          const [row] = await databaseTx.insert(aiCreditReservations).values(input).returning();
          if (!row) throw new Error('AI credit reservation insert did not return a row.');
          return mapReservation(row);
        },

        async claimSettlement(tenantId, reservationId, actualCredits, settledAt) {
          const [row] = await databaseTx
            .update(aiCreditReservations)
            .set({
              status: 'settled',
              settledCredits: actualCredits,
              settledAt,
              updatedAt: settledAt,
            })
            .where(
              and(
                eq(aiCreditReservations.tenantId, tenantId),
                eq(aiCreditReservations.id, reservationId),
                eq(aiCreditReservations.status, 'held'),
              ),
            )
            .returning();
          return row ? mapReservation(row) : null;
        },

        async claimRelease(tenantId, reservationId, reason, releasedAt) {
          const [row] = await databaseTx
            .update(aiCreditReservations)
            .set({
              status: 'released',
              releasedAt,
              releaseReason: reason,
              updatedAt: releasedAt,
            })
            .where(
              and(
                eq(aiCreditReservations.tenantId, tenantId),
                eq(aiCreditReservations.id, reservationId),
                eq(aiCreditReservations.status, 'held'),
              ),
            )
            .returning();
          return row ? mapReservation(row) : null;
        },

        async finalizeSettlementLinks(input) {
          const [row] = await databaseTx
            .update(aiCreditReservations)
            .set({
              releaseLedgerEntryId: input.releaseLedgerEntryId,
              usageEventId: input.usageEventId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiCreditReservations.tenantId, input.tenantId),
                eq(aiCreditReservations.id, input.reservationId),
                eq(aiCreditReservations.status, 'settled'),
              ),
            )
            .returning();
          if (!row) throw new Error('AI reservation settlement finalization did not return a row.');
          return mapReservation(row);
        },

        async finalizeReleaseLink(input) {
          const [row] = await databaseTx
            .update(aiCreditReservations)
            .set({
              releaseLedgerEntryId: input.releaseLedgerEntryId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiCreditReservations.tenantId, input.tenantId),
                eq(aiCreditReservations.id, input.reservationId),
                eq(aiCreditReservations.status, 'released'),
              ),
            )
            .returning();
          if (!row) throw new Error('AI reservation release finalization did not return a row.');
          return mapReservation(row);
        },

        async insertUsage(input) {
          const [row] = await databaseTx.insert(usageEvents).values(input).returning();
          if (!row) throw new Error('Usage insert did not return a row.');
          return mapUsage(row);
        },

        async insertLedger(input) {
          const [row] = await databaseTx.insert(creditLedgerEntries).values(input).returning();
          if (!row) throw new Error('Credit ledger insert did not return a row.');
          return mapLedger(row);
        },
      };

      return work(tx);
    });
  },
};
