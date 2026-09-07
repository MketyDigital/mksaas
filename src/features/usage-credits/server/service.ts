import { isUsageMeterKey } from '../meter-keys';
import {
  USAGE_CREDIT_ERROR_CODES,
  UsageCreditError,
  type ConsumeCreditsInput,
  type CreditMutationResult,
  type GrantCreditsInput,
  type RecordUsageInput,
  type UsageRecord,
} from '../types';
import { assertPositiveAmount, resolveIdempotency } from './engine';
import type {
  CreditLedgerRecord,
  StoredUsageRecord,
  UsageCreditSource,
  UsageCreditTransaction,
} from './source';

function grantFingerprint(input: GrantCreditsInput): string {
  return JSON.stringify({
    actorUserId: input.actorUserId ?? null,
    billingPeriodId: input.billingPeriodId ?? null,
    credits: input.credits.toString(),
    entryType: input.entryType,
    reason: input.reason ?? null,
    source: input.source,
  });
}

function storedGrantFingerprint(entry: CreditLedgerRecord): string {
  return JSON.stringify({
    actorUserId: entry.actorUserId,
    billingPeriodId: entry.billingPeriodId,
    credits: entry.delta.toString(),
    entryType: entry.entryType,
    reason: entry.reason,
    source: entry.source,
  });
}

function usageFingerprint(input: RecordUsageInput, creditsCharged: bigint): string {
  return JSON.stringify({
    credits: creditsCharged.toString(),
    meterKey: input.meter,
    projectId: input.projectId ?? null,
    quantity: input.quantity.toString(),
    source: input.source,
    workspaceKey: input.workspaceKey ?? null,
  });
}

function storedUsageFingerprint(event: StoredUsageRecord): string {
  return JSON.stringify({
    credits: event.creditsCharged.toString(),
    meterKey: event.meterKey,
    projectId: event.projectId,
    quantity: event.quantity.toString(),
    source: event.source,
    workspaceKey: event.workspaceKey,
  });
}

function toUsageRecord(event: StoredUsageRecord): UsageRecord {
  return {
    id: event.id,
    tenantId: event.tenantId,
    meter: event.meterKey,
    quantity: event.quantity,
    creditsCharged: event.creditsCharged,
    idempotencyKey: event.idempotencyKey,
    occurredAt: event.occurredAt,
  };
}

function requireBalance(balance: Awaited<ReturnType<UsageCreditTransaction['getCreditBalance']>>) {
  if (!balance) {
    throw new UsageCreditError(USAGE_CREDIT_ERROR_CODES.missingAccount, 'Credit account is not available.');
  }
  return balance;
}

function assertMeterAndQuantity(input: RecordUsageInput): void {
  if (!isUsageMeterKey(input.meter)) {
    throw new UsageCreditError(USAGE_CREDIT_ERROR_CODES.unknownMeter, 'Unknown usage meter.');
  }
  assertPositiveAmount(input.quantity);
}

export function createUsageCreditService(source: UsageCreditSource) {
  return {
    getCreditBalance(tenantId: string) {
      return source.getCreditBalance(tenantId);
    },

    getTenantUsage(tenantId: string) {
      return source.getTenantUsage(tenantId);
    },

    getCreditLedger(tenantId: string) {
      return source.getCreditLedger(tenantId);
    },

    async grantCredits(input: GrantCreditsInput): Promise<CreditMutationResult> {
      assertPositiveAmount(input.credits);
      const fingerprint = grantFingerprint(input);

      return source.transaction(async (tx) => {
        const existing = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);
        const resolution = resolveIdempotency({
          existing: existing
            ? { fingerprint: storedGrantFingerprint(existing), resultId: existing.id }
            : null,
          fingerprint,
        });

        if (resolution.kind === 'replay') {
          return {
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
            ledgerEntryId: resolution.resultId,
          };
        }

        const balance = await tx.applyGrant(input.tenantId, input.credits);
        const ledger = await tx.insertLedger({
          tenantId: input.tenantId,
          delta: input.credits,
          entryType: input.entryType,
          source: input.source,
          billingPeriodId: input.billingPeriodId ?? null,
          usageEventId: null,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason ?? null,
          actorUserId: input.actorUserId ?? null,
        });

        return { balance, ledgerEntryId: ledger.id };
      });
    },

    async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
      assertMeterAndQuantity(input);
      const fingerprint = usageFingerprint(input, 0n);

      return source.transaction(async (tx) => {
        const existingUsage = await tx.findUsageByIdempotency(input.tenantId, input.idempotencyKey);
        const existingLedger = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);

        if (existingLedger) {
          throw new UsageCreditError(
            USAGE_CREDIT_ERROR_CODES.idempotencyConflict,
            'Idempotency key was already used for a credit mutation.',
          );
        }

        if (existingUsage) {
          resolveIdempotency({
            existing: {
              fingerprint: storedUsageFingerprint(existingUsage),
              resultId: existingUsage.id,
            },
            fingerprint,
          });
          return toUsageRecord(existingUsage);
        }

        const usage = await tx.insertUsage({
          tenantId: input.tenantId,
          meterKey: input.meter,
          quantity: input.quantity,
          creditsCharged: 0n,
          idempotencyKey: input.idempotencyKey,
          projectId: input.projectId ?? null,
          workspaceKey: input.workspaceKey ?? null,
          source: input.source,
          occurredAt: input.occurredAt ?? new Date(),
        });

        return toUsageRecord(usage);
      });
    },

    async consumeCredits(input: ConsumeCreditsInput): Promise<CreditMutationResult> {
      assertMeterAndQuantity(input);
      assertPositiveAmount(input.credits);
      const fingerprint = usageFingerprint(input, input.credits);

      return source.transaction(async (tx) => {
        const existingUsage = await tx.findUsageByIdempotency(input.tenantId, input.idempotencyKey);
        const existingLedger = await tx.findLedgerByIdempotency(input.tenantId, input.idempotencyKey);

        if (existingUsage || existingLedger) {
          if (!existingUsage || !existingLedger) {
            throw new UsageCreditError(
              USAGE_CREDIT_ERROR_CODES.idempotencyConflict,
              'Idempotency state is inconsistent.',
            );
          }

          resolveIdempotency({
            existing: {
              fingerprint: storedUsageFingerprint(existingUsage),
              resultId: existingLedger.id,
            },
            fingerprint,
          });

          return {
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
            ledgerEntryId: existingLedger.id,
            usage: toUsageRecord(existingUsage),
          };
        }

        const current = requireBalance(await tx.getCreditBalance(input.tenantId));
        if (current.availableCredits < input.credits) {
          throw new UsageCreditError(
            USAGE_CREDIT_ERROR_CODES.insufficientCredits,
            'Insufficient credits.',
          );
        }

        const balance = await tx.applyDebit(input.tenantId, input.credits);
        if (!balance) {
          throw new UsageCreditError(
            USAGE_CREDIT_ERROR_CODES.insufficientCredits,
            'Insufficient credits.',
          );
        }

        const usage = await tx.insertUsage({
          tenantId: input.tenantId,
          meterKey: input.meter,
          quantity: input.quantity,
          creditsCharged: input.credits,
          idempotencyKey: input.idempotencyKey,
          projectId: input.projectId ?? null,
          workspaceKey: input.workspaceKey ?? null,
          source: input.source,
          occurredAt: input.occurredAt ?? new Date(),
        });
        const ledger = await tx.insertLedger({
          tenantId: input.tenantId,
          delta: -input.credits,
          entryType: 'usage',
          source: input.source,
          billingPeriodId: null,
          usageEventId: usage.id,
          idempotencyKey: input.idempotencyKey,
          reason: null,
          actorUserId: null,
        });

        return {
          balance,
          ledgerEntryId: ledger.id,
          usage: toUsageRecord(usage),
        };
      });
    },
  };
}
