import { ENTITLEMENT_KEYS, isEntitlementKey } from './entitlement-keys';

describe('entitlement keys', () => {
  it('includes canonical paid workspace capabilities', () => {
    expect(ENTITLEMENT_KEYS).toEqual(expect.arrayContaining([
      'workspace.ai',
      'workspace.automation',
      'workspace.deploy',
      'workspace.trading.enterprise',
      'workspace.ai.enterprise',
      'ai.api',
      'ai.byok',
      'ai.private_model',
      'ai.channel.website',
      'ai.channel.telegram',
    ]));
  });

  it('contains no duplicate canonical keys', () => {
    expect(new Set(ENTITLEMENT_KEYS).size).toBe(ENTITLEMENT_KEYS.length);
  });

  it('rejects unknown runtime entitlement strings', () => {
    expect(isEntitlementKey('workspace.unknown')).toBe(false);
  });

  it('accepts registered runtime entitlement strings', () => {
    expect(isEntitlementKey('workspace.workflows')).toBe(true);
    expect(isEntitlementKey('workspace.ai.enterprise')).toBe(true);
  });
});
