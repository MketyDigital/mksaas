import { and, eq, gte, sql } from 'drizzle-orm';

import { getEnterpriseAiContractBillingSummary } from '@/features/ai-runtime/server/enterprise-contracts';
import { getCreditBalance } from '@/features/usage-credits/server/service';
import { db } from '@/shared/db/cloudflare';
import { aiRequests } from '@/shared/db/schema';

function startOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getEnterpriseAiCustomerSummary(tenantId: string, now = new Date()) {
  const periodStart = startOfMonth(now);
  const [billing, credits, usageRows] = await Promise.all([
    getEnterpriseAiContractBillingSummary(tenantId),
    getCreditBalance(tenantId),
    db
      .select({
        requests: sql<bigint>`count(*)::bigint`,
        inputTokens: sql<bigint>`coalesce(sum(${aiRequests.inputTokens}), 0)::bigint`,
        cachedInputTokens: sql<bigint>`coalesce(sum(${aiRequests.cachedInputTokens}), 0)::bigint`,
        outputTokens: sql<bigint>`coalesce(sum(${aiRequests.outputTokens}), 0)::bigint`,
        settledCredits: sql<bigint>`coalesce(sum(${aiRequests.settledCredits}), 0)::bigint`,
      })
      .from(aiRequests)
      .where(and(eq(aiRequests.tenantId, tenantId), gte(aiRequests.startedAt, periodStart))),
  ]);

  const usage = usageRows[0] ?? {
    requests: 0n,
    inputTokens: 0n,
    cachedInputTokens: 0n,
    outputTokens: 0n,
    settledCredits: 0n,
  };

  return {
    periodStart,
    billing,
    credits,
    usage,
  };
}
