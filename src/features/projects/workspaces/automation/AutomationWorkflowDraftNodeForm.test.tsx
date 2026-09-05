import { render, screen } from '@testing-library/react';

import { AutomationWorkflowDraftNodeForm } from './AutomationWorkflowDraftNodeForm';

describe('AutomationWorkflowDraftNodeForm', () => {
  it('renders supported draft node types for managers without runtime controls', () => {
    render(
      <AutomationWorkflowDraftNodeForm
        canManage
        projectSlug="demo"
        tenantSlug="acme"
        workflowSlug="lead-follow-up"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add draft node' })).toBeInTheDocument();
    expect(screen.getByLabelText('Node type')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Agent' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'HTTP' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Transform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add draft node' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Credentials/i)).not.toBeInTheDocument();
  });

  it('renders a permission boundary for non-managers', () => {
    render(
      <AutomationWorkflowDraftNodeForm
        canManage={false}
        projectSlug="demo"
        tenantSlug="acme"
        workflowSlug="lead-follow-up"
      />,
    );

    expect(screen.getByText(/Only managers can add draft nodes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add draft node' })).not.toBeInTheDocument();
  });
});
