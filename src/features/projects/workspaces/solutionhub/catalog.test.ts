import {
  getSolutionHubEntriesByClass,
  getSolutionHubEntryDestination,
  solutionHubCatalog,
} from './catalog';

describe('SolutionHub catalog', () => {
  it('keeps the approved Mkety example solutions visible', () => {
    expect(solutionHubCatalog.map((entry) => entry.title)).toEqual(
      expect.arrayContaining([
        'Customer Support AI',
        'Lead Capture Automation',
        'Telegram Workflow',
        'Business Website',
        'AI Knowledge Assistant',
        'Marketing Automation',
        'Trading Automation',
      ]),
    );
  });

  it('requires every shared-platform entry to target an existing self-service workspace', () => {
    const shared = getSolutionHubEntriesByClass('shared-platform');

    expect(shared).toHaveLength(6);
    expect(shared.every((entry) => ['ai', 'automation', 'deploy'].includes(entry.workspaceTarget ?? ''))).toBe(true);

    for (const entry of shared) {
      expect(
        getSolutionHubEntryDestination(entry, { tenantSlug: 'acme', projectSlug: 'demo' }),
      ).toMatch(/^\/t\/acme\/projects\/demo\/(ai|automation|deploy)$/);
    }
  });

  it('keeps dedicated, regulated, complex ERP and Trading requirements Enterprise-only', () => {
    const enterprise = getSolutionHubEntriesByClass('enterprise-custom');

    expect(enterprise).toHaveLength(4);
    expect(enterprise.every((entry) => entry.workspaceTarget === undefined)).toBe(true);
    expect(enterprise.every((entry) => entry.enterpriseReason)).toBe(true);

    for (const entry of enterprise) {
      expect(
        getSolutionHubEntryDestination(entry, { tenantSlug: 'acme', projectSlug: 'demo' }),
      ).toBe('/enterprise');
    }
  });

  it('does not define an install or provisioning delivery class', () => {
    expect(solutionHubCatalog.map((entry) => entry.deliveryClass)).not.toContain('install');
    expect(solutionHubCatalog.map((entry) => entry.deliveryClass)).not.toContain('provision');
  });
});
