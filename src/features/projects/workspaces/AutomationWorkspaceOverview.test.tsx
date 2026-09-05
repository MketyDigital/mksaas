import { render, screen } from '@testing-library/react';

import {
  AutomationWorkspaceOverview,
  buildAutomationWorkspaceCapabilities,
  emptyAutomationWorkspaceSnapshot,
} from './AutomationWorkspaceOverview';

describe('AutomationWorkspaceOverview', () => {
  it('renders the automation workspace capability map and read-only metrics', () => {
    render(<AutomationWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('heading', { name: /Design repeatable workflows safely/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Triggers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Run history' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Failures & retries' })).toBeInTheDocument();
    expect(screen.getByText('Execution disabled')).toBeInTheDocument();
    expect(screen.getByText('Run records')).toBeInTheDocument();
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

  it('renders recent workflow records without live execution controls', () => {
    render(
      <AutomationWorkspaceOverview
        projectSlug="demo"
        snapshot={{
          ...emptyAutomationWorkspaceSnapshot,
          metrics: {
            ...emptyAutomationWorkspaceSnapshot.metrics,
            workflowCount: 1,
            draftWorkflowCount: 1,
          },
          recentWorkflows: [
            {
              id: 'workflow-1',
              name: 'Lead follow-up',
              slug: 'lead-follow-up',
              status: 'draft',
              triggerType: 'manual',
              version: '1',
              updatedAt: new Date('2026-09-05T12:00:00Z'),
            },
          ],
        }}
        tenantSlug="acme"
      />,
    );

    expect(screen.getByText('Lead follow-up')).toBeInTheDocument();
    expect(screen.getByText(/manual trigger/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
  });
});
