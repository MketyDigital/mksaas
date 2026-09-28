import {
  DEFAULT_AI_RELIABILITY_POLICY,
  getRetryDelayMs,
  mayRetryAiRequest,
} from './reliability-policy';

describe('AI reliability policy', () => {
  it('keeps retries bounded', () => {
    expect(DEFAULT_AI_RELIABILITY_POLICY.maxAttempts).toBe(2);
    expect(mayRetryAiRequest({ attempt: 1, status: 503, idempotent: true })).toBe(true);
    expect(mayRetryAiRequest({ attempt: 2, status: 503, idempotent: true })).toBe(false);
  });

  it('never retries a non-idempotent request automatically', () => {
    expect(mayRetryAiRequest({ attempt: 1, status: 503, idempotent: false })).toBe(false);
  });

  it('uses bounded exponential backoff', () => {
    expect(getRetryDelayMs(1)).toBe(250);
    expect(getRetryDelayMs(2)).toBe(500);
    expect(getRetryDelayMs(10)).toBe(2_000);
  });
});
