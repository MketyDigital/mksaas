import { render, screen } from '@testing-library/react';

import {
  AutomationWorkspaceOverview,
  buildAutomationWorkspaceCapabilities,
  emptyAutomationWorkspaceSnapshot,
} from './AutomationWorkspaceOverview';

describe('AutomationWorkspaceOverview', () => {
  it('renders the automation workspace capability map and execution metrics', () => {
    render(<AutomationWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('heading', { name: /Design repeatable workflows safely/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Triggers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Run history' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Failures & retries' })).toBeInTheDocument();
    expect(screen.getByText('Execution enabled')).toBeInTheDocument();
    expect(screen.getByText('Run records')).toBeInTheDocument();
  });

  it('marks authenticated webhooks available while keeping management inside workflow builders', () => {
    const webhooks = buildAutomationWorkspaceCapabilities({ projectSlug: 'demo', tenantSlug: 'acme' }).find(
      (capability) => capability.key === 'webhooks',
    );

    expect(webhooks?.statusLabel).toBe('Builder-managed');
    expect(webhooks?.status).toBe('available');
    expect(webhooks?.href).toBeUndefined();
  });

  it('does not expose global run or activation actions and preserves bounded future phases', () => {
    render(<AutomationWorkspaceOverview projectSlug="demo" tenantSlug="acme" />);

    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Activate workflow/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Manual and authenticated webhook execution are available/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedules, retries, Agent tools, and arbitrary credentials remain disabled/i)).toBeInTheDocument();
  });

  it('links recent workflow records to the builder', () => {
    render(
      <AutomationWorkspaceOverview
        projectSlug="demo"
        snapshot={{
          ...emptyAutomationWorkspaceSnapshot,
          metrics: {
            ...emptyAutomationWorkspaceSnapshot.metrics,
            draftWorkflowCount: 1,
            workflowCount: 1,
          },
          recentWorkflows: [
            {
              id: 'workflow-1',
              name: 'Lead follow-up',
              slug: 'lead-follow-up',
              status: 'draft',
              triggerType: 'manual',
              updatedAt: new Date('2026-09-05T12:00:00Z'),
              version: '1',
            },
          ],
        }}
        tenantSlug="acme"
      />,
    );

    expect(screen.getByText('Lead follow-up')).toBeInTheDocument();
    expect(screen.getByText(/manual trigger/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open builder' })).toHaveAttribute(
      'href',
      '/t/acme/projects/demo/automation/lead-follow-up',
    );
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
  });
});