import { ENTITLEMENT_KEYS } from '@/features/entitlements/entitlement-keys';

import { isUsageMeterKey, type UsageMeterKey } from './meter-keys';
import { USAGE_CREDIT_ERROR_CODES, UsageCreditError } from './types';

describe('usage credit meter vocabulary', () => {
  const expectedKeys = [
    'ai.generation',
    'ai.tokens.input',
    'ai.tokens.output',
    'automation.run',
    'workflow.execution',
    'knowledge.ingestion',
    'webhook.delivery',
  ] as const satisfies readonly UsageMeterKey[];

  it('recognizes every approved stable meter key', () => {
    for (const key of expectedKeys) {
      expect(isUsageMeterKey(key)).toBe(true);
    }
  });

  it('rejects unknown meter keys', () => {
    expect(isUsageMeterKey('ai.provider.openai.tokens')).toBe(false);
    expect(isUsageMeterKey('workspace.trading.enterprise')).toBe(false);
  });

  it('keeps meter vocabulary separate from entitlement vocabulary', () => {
    for (const key of expectedKeys) {
      expect(ENTITLEMENT_KEYS).not.toContain(key);
    }
  });

  it('exposes stable safe domain error codes', () => {
    expect(USAGE_CREDIT_ERROR_CODES).toEqual({
      idempotencyConflict: 'USAGE_CREDIT_IDEMPOTENCY_CONFLICT',
      insufficientCredits: 'USAGE_CREDIT_INSUFFICIENT_CREDITS',
      invalidAmount: 'USAGE_CREDIT_INVALID_AMOUNT',
      missingAccount: 'USAGE_CREDIT_MISSING_ACCOUNT',
      unknownMeter: 'USAGE_CREDIT_UNKNOWN_METER',
    });

    const error = new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.insufficientCredits,
      'Insufficient credits.',
    );

    expect(error.code).toBe('USAGE_CREDIT_INSUFFICIENT_CREDITS');
    expect(error.message).toBe('Insufficient credits.');
  });
});
