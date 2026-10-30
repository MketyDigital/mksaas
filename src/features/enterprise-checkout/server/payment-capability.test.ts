import {
  createEnterprisePaymentCapability,
  hashEnterprisePaymentToken,
  isEnterprisePaymentCapabilityActive,
} from './payment-capability';

describe('Enterprise customer payment capability', () => {
  it('creates an unguessable token but returns only a one-way hash for persistence', async () => {
    const now = new Date('2026-10-23T00:00:00.000Z');
    const capability = await createEnterprisePaymentCapability(now);
    expect(capability.token).toMatch(/^[a-f0-9]{64}$/);
    expect(capability.tokenHash).toBe(await hashEnterprisePaymentToken(capability.token));
    expect(capability.tokenHash).not.toBe(capability.token);
    expect(capability.expiresAt.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects malformed, expired and empty payment capabilities', async () => {
    await expect(hashEnterprisePaymentToken('bad')).rejects.toThrow(/invalid/);
    expect(isEnterprisePaymentCapabilityActive({ tokenHash: 'x'.repeat(64), expiresAt: new Date('2026-10-22T23:59:59Z'), now: new Date('2026-10-23T00:00:00Z') })).toBe(false);
    expect(isEnterprisePaymentCapabilityActive({ tokenHash: null, expiresAt: null })).toBe(false);
  });
});
