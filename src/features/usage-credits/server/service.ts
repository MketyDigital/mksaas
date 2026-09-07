import { isUsageMeterKey } from '../meter-keys';
import {
  USAGE_CREDIT_ERROR_CODES,
  UsageCreditError,
  type ConsumeCreditsInput,
  type CreditMutationResult,
  type GrantCreditsInput,
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

function consumeFingerprint(input: ConsumeCreditsInput): string {
  return JSON.stringify({
    credits: input.credits.toString(),
    meterKey: input.meter,
    projectId: input.projectId ?? null,
    quantity: input.quantity.toString(),
    source: input.source,
    workspaceKey: input.workspaceKey ?? null,
  });
}

function storedConsumeFingerprint(event: StoredUsageRecord): string {
  return JSON.stringify({
    credits: event.creditsCharged.toString(),
    meterKey: event.meterKey,
    projectId: event.projectId,
    quantity: event.quantity.toString(),
    source: event.source,
    workspaceKey: event.workspaceKey,
  });
}

function requireBalance(balance: Awaited<ReturnType<UsageCreditTransaction['getCreditBalance']>>) {
  if (!balance) {
    throw new UsageCreditError(USAGE_CREDIT_ERROR_CODES.missingAccount, 'Credit account is not available.');
  }
  return balance;
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

    async consumeCredits(input: ConsumeCreditsInput): Promise<CreditMutationResult> {
      if (!isUsageMeterKey(input.meter)) {
        throw new UsageCreditError(USAGE_CREDIT_ERROR_CODES.unknownMeter, 'Unknown usage meter.');
      }
      assertPositiveAmount(input.quantity);
      assertPositiveAmount(input.credits);
      const fingerprint = consumeFingerprint(input);

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
              fingerprint: storedConsumeFingerprint(existingUsage),
              resultId: existingLedger.id,
            },
            fingerprint,
          });

          return {
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
            ledgerEntryId: existingLedger.id,
            usage: {
              id: existingUsage.id,
              tenantId: existingUsage.tenantId,
              meter: existingUsage.meterKey,
              quantity: existingUsage.quantity,
              creditsCharged: existingUsage.creditsCharged,
              idempotencyKey: existingUsage.idempotencyKey,
              occurredAt: existingUsage.occurredAt,
            },
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

        const occurredAt = input.occurredAt ?? new Date();
        const usage = await tx.insertUsage({
          tenantId: input.tenantId,
          meterKey: input.meter,
          quantity: input.quantity,
          creditsCharged: input.credits,
          idempotencyKey: input.idempotencyKey,
          projectId: input.projectId ?? null,
          workspaceKey: input.workspaceKey ?? null,
          source: input.source,
          occurredAt,
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
          usage: {
            id: usage.id,
            tenantId: usage.tenantId,
            meter: usage.meterKey,
            quantity: usage.quantity,
            creditsCharged: usage.creditsCharged,
            idempotencyKey: usage.idempotencyKey,
            occurredAt: usage.occurredAt,
          },
        };
      });
    },
  };
}
