import { isMailStorageWithinLimit } from './storage-capacity';

describe('Mail storage capacity', () => {
  it('accepts data up to the active offer limit and rejects overflow', () => {
    expect(isMailStorageWithinLimit(900, 100, 1000)).toBe(true);
    expect(isMailStorageWithinLimit(900, 101, 1000)).toBe(false);
  });

  it('supports the internal unlimited profile while rejecting invalid usage values', () => {
    expect(isMailStorageWithinLimit(1_000_000, 100, null)).toBe(true);
    expect(isMailStorageWithinLimit(-1, 100, null)).toBe(false);
    expect(isMailStorageWithinLimit(0, Number.NaN, null)).toBe(false);
  });
});
