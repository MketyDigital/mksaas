import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiRuntimePolicies } from '@/shared/db/schema/ai-runtime';

export const ENTERPRISE_AI_RUNTIME_POLICY_KEY = 'enterprise-default';

export type EnterpriseAiRuntimePolicy = {
  maxRequestBytes: number;
  maxMessages: number;
  maxTools: number;
  maxOutputTokens: number;
  reservationTtlSeconds: number;
  prepaidOnly: true;
  customerInferenceEnabled: boolean;
};

const FALLBACK_POLICY: EnterpriseAiRuntimePolicy = {
  maxRequestBytes: 1_000_000,
  maxMessages: 128,
  maxTools: 64,
  maxOutputTokens: 32_768,
  reservationTtlSeconds: 120,
  prepaidOnly: true,
  customerInferenceEnabled: false,
};

export async function getEnterpriseAiRuntimePolicy(): Promise<EnterpriseAiRuntimePolicy> {
  const row = await db.query.aiRuntimePolicies.findFirst({
    where: eq(aiRuntimePolicies.key, ENTERPRISE_AI_RUNTIME_POLICY_KEY),
  });

  if (!row) return FALLBACK_POLICY;
  if (!row.prepaidOnly) {
    throw new Error('Enterprise AI runtime policy violated prepaid-only invariant.');
  }

  return {
    maxRequestBytes: row.maxRequestBytes,
    maxMessages: row.maxMessages,
    maxTools: row.maxTools,
    maxOutputTokens: row.maxOutputTokens,
    reservationTtlSeconds: row.reservationTtlSeconds,
    prepaidOnly: true,
    customerInferenceEnabled: row.customerInferenceEnabled,
  };
}
