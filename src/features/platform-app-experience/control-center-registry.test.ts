import { platformControlModules } from './control-center-registry';
import { appControlCenterModuleSchema } from './schemas';

describe('platform control center registry', () => {
  it('contains unique module keys and valid module definitions', () => {
    const keys = platformControlModules.map((controlModule) => controlModule.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const controlModule of platformControlModules) {
      expect(() => appControlCenterModuleSchema.parse(controlModule)).not.toThrow();
    }
  });

  it('keeps protected platform domains and routing modules explicit', () => {
    expect(platformControlModules.map((controlModule) => controlModule.key)).toEqual(
      expect.arrayContaining(['public-site-docs', 'app-experience', 'domains-routing', 'auth-gateway', 'security-audit']),
    );

    const domainsRouting = platformControlModules.find((controlModule) => controlModule.key === 'domains-routing');
    expect(domainsRouting?.domain).toBe('multi-domain');
    expect(domainsRouting?.protectedScope.join(' ')).toContain('unapproved hostnames');

    const authGateway = platformControlModules.find((controlModule) => controlModule.key === 'auth-gateway');
    expect(authGateway?.protectedScope.join(' ')).toContain('private keys');
  });

  it('does not model billing or security modules as ordinary public content editors', () => {
    const billing = platformControlModules.find((controlModule) => controlModule.key === 'billing-ledger');
    const security = platformControlModules.find((controlModule) => controlModule.key === 'security-audit');

    expect(billing?.status).toBe('protected');
    expect(billing?.protectedScope.join(' ')).toContain('direct balance editing');
    expect(security?.status).toBe('protected');
    expect(security?.protectedScope.join(' ')).toContain('tenant isolation rules');
  });
});
