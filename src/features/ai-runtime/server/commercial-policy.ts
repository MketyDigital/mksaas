import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiRuntimePolicies } from '@/shared/db/schema/ai-runtime';

export const ENTERPRISE_AI_RUNTIME_POLICY_KEY = 'enterprise-default';

export type EnterpriseAiRuntimePolicy = {
  key: string;
  maxRequestBytes: number;
  maxMessages: number;
  maxTools: number;
  maxOutputTokens: number;
  reservationTtlSeconds: number;
  prepaidOnly: true;
  customerInferenceEnabled: boolean;
};

const FAIL_CLOSED_POLICY: EnterpriseAiRuntimePolicy = {
  key: ENTERPRISE_AI_RUNTIME_POLICY_KEY,
  maxRequestBytes: 1_000_000,
  maxMessages: 128,
  maxTools: 64,
  maxOutputTokens: 32_768,
  reservationTtlSeconds: 120,
  prepaidOnly: true,
  customerInferenceEnabled: false,
};

export async function getEnterpriseAiRuntimePolicy(): Promise<EnterpriseAiRuntimePolicy> {
  const policy = await db.query.aiRuntimePolicies.findFirst({
    where: eq(aiRuntimePolicies.key, ENTERPRISE_AI_RUNTIME_POLICY_KEY),
  });

  if (!policy) return FAIL_CLOSED_POLICY;
  if (!policy.prepaidOnly) {
    throw new Error('Enterprise AI runtime policy violated prepaid-only invariant.');
  }

  return {
    key: policy.key,
    maxRequestBytes: policy.maxRequestBytes,
    maxMessages: policy.maxMessages,
    maxTools: policy.maxTools,
    maxOutputTokens: policy.maxOutputTokens,
    reservationTtlSeconds: policy.reservationTtlSeconds,
    prepaidOnly: true,
    customerInferenceEnabled: policy.customerInferenceEnabled,
  };
}
