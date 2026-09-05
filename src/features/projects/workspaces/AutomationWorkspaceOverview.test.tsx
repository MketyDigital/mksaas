import { render, screen } from '@testing-library/react';

import { AutomationWorkspaceOverview, buildAutomationWorkspaceCapabilities } from './AutomationWorkspaceOverview';

describe('AutomationWorkspaceOverview', () => {
  it('renders the automation workspace capability map', () => {
    render(<AutomationWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('heading', { name: /Design repeatable workflows safely/i })).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Run history')).toBeInTheDocument();
    expect(screen.getByText('Failures & retries')).toBeInTheDocument();
    expect(screen.getByText('Blueprint only')).toBeInTheDocument();
  });

  it('keeps webhooks protected until endpoint security is implemented', () => {
    const webhooks = buildAutomationWorkspaceCapabilities({ projectSlug: 'demo', tenantSlug: 'acme' }).find(
      (capability) => capability.key === 'webhooks',
    );

    expect(webhooks?.statusLabel).toBe('Protected');
    expect(webhooks?.href).toBeUndefined();
  });

  it('does not expose active workflow execution links yet', () => {
    render(<AutomationWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Automation execution remains intentionally inactive/i)).toBeInTheDocument();
  });
});
