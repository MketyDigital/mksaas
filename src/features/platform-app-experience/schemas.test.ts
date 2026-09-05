import { appControlCenterModuleSchema, appDashboardSettingsSchema, workspaceCardSchema } from './schemas';

describe('platform app experience content schemas', () => {
  it('validates dashboard presentation settings', () => {
    expect(
      appDashboardSettingsSchema.parse({
        headline: 'Build and operate from one Mkety workspace',
        description: 'Manage projects, workspaces, usage, docs, and support from your dashboard.',
        primaryCta: { label: 'Create Project', href: '/create-workspace' },
        secondaryCta: { label: 'Explore SolutionHub', href: '/app/solutions' },
      }).primaryCta.label,
    ).toBe('Create Project');
  });

  it('validates workspace cards without granting backend access', () => {
    const card = workspaceCardSchema.parse({
      key: 'trading',
      label: 'Trading Workspace',
      description: 'Custom and enterprise trading infrastructure.',
      href: '/app/trading',
      enabled: true,
      requiresEntitlement: 'workspace.trading.enterprise',
    });

    expect(card.requiresEntitlement).toBe('workspace.trading.enterprise');
  });

  it('requires each control center module to have a permission key', () => {
    expect(
      appControlCenterModuleSchema.parse({
        key: 'billing-ledger',
        label: 'Billing & Ledger',
        description: 'View ledger entries and create controlled adjustments.',
        href: '/admin/platform-control/billing',
        level: 3,
        requiredPermission: 'platform:billing',
      }).requiredPermission,
    ).toBe('platform:billing');

    expect(() =>
      appControlCenterModuleSchema.parse({
        key: 'security',
        label: 'Security',
        description: 'Security monitoring.',
        href: '/admin/platform-control/security',
        level: 4,
      }),
    ).toThrow();
  });
});
