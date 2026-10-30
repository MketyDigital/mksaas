import {
  createMketyAppHostname,
  normalizeMketyAppHostname,
  resolveMketyAppHostname,
} from './hostnames';

describe('Mkety app deployment hostnames', () => {
  it('normalizes only one ASCII customer label under mkety.app', () => {
    expect(normalizeMketyAppHostname('  Demo-App.MKETY.APP. ')).toBe('demo-app.mkety.app');
    expect(normalizeMketyAppHostname('mkety.app')).toBeNull();
    expect(normalizeMketyAppHostname('one.two.mkety.app')).toBeNull();
    expect(normalizeMketyAppHostname('équipe.mkety.app')).toBeNull();
    expect(normalizeMketyAppHostname('demo.app.attacker.test')).toBeNull();
  });

  it.each(['www', 'api', 'app', 'admin', 'ops', 'static', 'assets', 'status', 'support', 'docs'])
    ('rejects reserved label %s', (label) => {
      expect(normalizeMketyAppHostname(`${label}.mkety.app`)).toBeNull();
    });

  it('creates a collision-resistant hostname from a slug and stable deployment identity', () => {
    expect(createMketyAppHostname('Customer Portal', 'deployment-0123456789abcdef')).toBe('customer-portal-6789abcdef.mkety.app');
    expect(() => createMketyAppHostname('App', 'short')).toThrow(/stable deployment id/i);
  });

  it('resolves only normalized active host records', async () => {
    const findActiveByHostname = jest.fn().mockResolvedValue({
      deploymentId: 'deployment-1',
      tenantId: 'tenant-1',
      providerDeploymentRef: 'customer-worker-1',
      kind: 'preview',
      status: 'active',
    });
    await expect(resolveMketyAppHostname('Demo-App.MKETY.APP.', { findActiveByHostname }))
      .resolves.toMatchObject({ deploymentId: 'deployment-1' });
    expect(findActiveByHostname).toHaveBeenCalledWith('demo-app.mkety.app');
    await expect(resolveMketyAppHostname('mkety.app', { findActiveByHostname })).resolves.toBeNull();
  });
});
