import { render, screen } from '@testing-library/react';

import { buildDeployWorkspaceCapabilities, DeployWorkspaceOverview } from './DeployWorkspaceOverview';

describe('DeployWorkspaceOverview', () => {
  it('renders the deploy workspace capability map', () => {
    render(<DeployWorkspaceOverview projectSlug="client-portal" tenantSlug="mkety" />);

    expect(screen.getByRole('heading', { name: 'Prepare apps, environments, and releases safely' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apps & websites' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Environments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deployments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Domains' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Previews' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Production' })).toBeInTheDocument();
  });

  it('keeps domains and production protected until deployment safety exists', () => {
    const capabilities = buildDeployWorkspaceCapabilities({ projectSlug: 'client-portal', tenantSlug: 'mkety' });

    expect(capabilities.find((capability) => capability.key === 'domains')?.status).toBe('protected');
    expect(capabilities.find((capability) => capability.key === 'production')?.status).toBe('protected');
  });

  it('does not expose live infrastructure action links yet', () => {
    const capabilities = buildDeployWorkspaceCapabilities({ projectSlug: 'client-portal', tenantSlug: 'mkety' });

    expect(capabilities.every((capability) => capability.href === undefined)).toBe(true);
    expect(screen.queryByRole('link', { name: /deploy/i })).not.toBeInTheDocument();
  });
});
