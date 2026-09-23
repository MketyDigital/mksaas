import { render, screen } from '@testing-library/react';

import {
  getSolutionHubEntriesByClass,
  solutionHubCatalog,
} from './solutionhub/catalog';
import { SolutionHubWorkspaceOverview } from './SolutionHubWorkspaceOverview';

describe('SolutionHubWorkspaceOverview', () => {
  it('renders the authenticated shared-platform and Enterprise catalog', () => {
    render(<SolutionHubWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(
      screen.getByRole('heading', { name: /Start from a proven solution path/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Build with existing Mkety workspaces/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Requirements that need reviewed delivery/i }),
    ).toBeInTheDocument();

    for (const entry of solutionHubCatalog) {
      expect(screen.getByRole('heading', { name: entry.title })).toBeInTheDocument();
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it('routes shared-platform patterns into the current project workspaces', () => {
    render(<SolutionHubWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getAllByRole('link', { name: 'Open AI Workspace' })[0]).toHaveAttribute(
      'href',
      '/t/acme/projects/demo/ai',
    );
    expect(screen.getAllByRole('link', { name: 'Open Automation' })[0]).toHaveAttribute(
      'href',
      '/t/acme/projects/demo/automation',
    );
    expect(screen.getByRole('link', { name: 'Open Deploy' })).toHaveAttribute(
      'href',
      '/t/acme/projects/demo/deploy',
    );
  });

  it('keeps complex and Trading paths on Enterprise instead of self-service install', () => {
    render(<SolutionHubWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    const enterpriseEntries = getSolutionHubEntriesByClass('enterprise-custom');
    expect(enterpriseEntries.map((entry) => entry.key)).toEqual([
      'complex-erp',
      'regulated-data-system',
      'private-dedicated-runtime',
      'trading-automation',
    ]);

    const enterpriseLinks = screen.getAllByRole('link', { name: 'Request Enterprise' });
    expect(enterpriseLinks).toHaveLength(enterpriseEntries.length);
    for (const link of enterpriseLinks) {
      expect(link).toHaveAttribute('href', '/enterprise');
    }
  });

  it('does not expose install or provisioning actions', () => {
    render(<SolutionHubWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.queryByRole('link', { name: /install|provision|clone/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Clone\/install, provisioning, entitlement mutation/i),
    ).toBeInTheDocument();
  });
});
