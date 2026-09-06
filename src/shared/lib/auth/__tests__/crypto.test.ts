import { generateOpaqueToken, hashToken, isSafeReturnTo } from '../crypto';

describe('Mkety Auth crypto helpers', () => {
  it('generates unique opaque session tokens', () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).toHaveLength(43);
    expect(second).toHaveLength(43);
    expect(first).not.toBe(second);
  });

  it('hashes a token deterministically without returning the raw token', async () => {
    const token = 'mkety-test-session-token';
    const hash = await hashToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    await expect(hashToken(token)).resolves.toBe(hash);
  });

  it('accepts only same-origin relative return paths', () => {
    expect(isSafeReturnTo('/select-tenant')).toBe(true);
    expect(isSafeReturnTo('/t/acme')).toBe(true);
    expect(isSafeReturnTo('https://evil.example/steal')).toBe(false);
    expect(isSafeReturnTo('//evil.example/steal')).toBe(false);
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false);
    expect(isSafeReturnTo('select-tenant')).toBe(false);
  });
});
