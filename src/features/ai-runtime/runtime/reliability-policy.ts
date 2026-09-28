export interface AiReliabilityPolicy {
  providerTimeoutMs: number;
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  retryableStatuses: readonly number[];
}

export const DEFAULT_AI_RELIABILITY_POLICY: AiReliabilityPolicy = {
  providerTimeoutMs: 45_000,
  maxAttempts: 2,
  initialBackoffMs: 250,
  maxBackoffMs: 2_000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export function getRetryDelayMs(attempt: number, policy = DEFAULT_AI_RELIABILITY_POLICY) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Retry attempt must be a positive integer.');
  return Math.min(policy.initialBackoffMs * (2 ** (attempt - 1)), policy.maxBackoffMs);
}

export function mayRetryAiRequest(input: {
  attempt: number;
  status: number;
  idempotent: boolean;
  policy?: AiReliabilityPolicy;
}) {
  const policy = input.policy ?? DEFAULT_AI_RELIABILITY_POLICY;
  return input.idempotent
    && input.attempt < policy.maxAttempts
    && policy.retryableStatuses.includes(input.status);
}
