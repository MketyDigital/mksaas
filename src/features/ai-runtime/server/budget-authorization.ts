import { and, eq, gt, lte } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiBudgets } from '@/shared/db/schema';

export type AiBudgetAuthorization =
  | { ok: true; budgetId: string }
  | { ok: false; code: 'budget_missing' | 'budget_exhausted' };

export async function authorizeAiBudget(input: {
  tenantId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  now?: Date;
}): Promise<AiBudgetAuthorization> {
  const now = input.now ?? new Date();
  const rows = await db.query.aiBudgets.findMany({
    where: and(
      eq(aiBudgets.tenantId, input.tenantId),
      lte(aiBudgets.startsAt, now),
      gt(aiBudgets.endsAt, now),
    ),
  });

  const eligible = rows
    .filter((row) => (row.projectId === null || row.projectId === (input.projectId ?? null)))
    .filter((row) => (row.apiKeyId === null || row.apiKeyId === (input.apiKeyId ?? null)))
    .sort((a, b) => Number(Boolean(b.apiKeyId)) - Number(Boolean(a.apiKeyId))
      || Number(Boolean(b.projectId)) - Number(Boolean(a.projectId)));

  const budget = eligible[0];
  if (!budget) return { ok: false, code: 'budget_missing' };

  const requestsExhausted =
    budget.maxRequests !== null &&
    budget.usedRequests + budget.reservedRequests >= budget.maxRequests;
  const creditsExhausted =
    budget.maxCredits !== null &&
    budget.usedCredits + budget.reservedCredits >= budget.maxCredits;
  if (budget.hardStop && (requestsExhausted || creditsExhausted)) {
    return { ok: false, code: 'budget_exhausted' };
  }

  return { ok: true, budgetId: budget.id };
}
