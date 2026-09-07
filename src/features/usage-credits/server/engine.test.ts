import { USAGE_CREDIT_ERROR_CODES, UsageCreditError } from '../types';
import {
  assertKnownMeter,
  assertPositiveAmount,
  assertSufficientCredits,
  resolveIdempotency,
} from './engine';

describe('usage credit mutation rules', () => {
  it('rejects zero and negative amounts', () => {
    for (const value of [0n, -1n]) {
      expect(() => assertPositiveAmount(value)).toThrow(
        expect.objectContaining({ code: USAGE_CREDIT_ERROR_CODES.invalidAmount }),
      );
    }
  });

  it('rejects unknown meter keys before storage', () => {
    expect(() => assertKnownMeter('provider.openai.tokens')).toThrow(
      expect.objectContaining({ code: USAGE_CREDIT_ERROR_CODES.unknownMeter }),
    );
  });

  it('rejects a debit larger than the available balance', () => {
    expect(() => assertSufficientCredits(50n, 51n)).toThrow(
      expect.objectContaining({ code: USAGE_CREDIT_ERROR_CODES.insufficientCredits }),
    );
  });

  it('replays an existing idempotent result with the same fingerprint', () => {
    expect(
      resolveIdempotency({
        existing: { fingerprint: 'same', resultId: 'ledger-1' },
        fingerprint: 'same',
      }),
    ).toEqual({ kind: 'replay', resultId: 'ledger-1' });
  });

  it('rejects conflicting reuse of an idempotency key', () => {
    expect(() =>
      resolveIdempotency({
        existing: { fingerprint: 'first', resultId: 'ledger-1' },
        fingerprint: 'second',
      }),
    ).toThrow(
      expect.objectContaining({ code: USAGE_CREDIT_ERROR_CODES.idempotencyConflict }),
    );
  });

  it('allows a new idempotent operation to proceed', () => {
    expect(resolveIdempotency({ existing: null, fingerprint: 'new' })).toEqual({ kind: 'proceed' });
  });

  it('keeps domain errors safe and typed', () => {
    expect(new UsageCreditError(USAGE_CREDIT_ERROR_CODES.invalidAmount, 'Invalid credit amount.')).toBeInstanceOf(
      Error,
    );
  });
});
