import { render, screen } from '@testing-library/react';

import { AutomationWorkflowDraftForm } from './AutomationWorkflowDraftForm';

describe('AutomationWorkflowDraftForm', () => {
  it('renders draft creation fields for managers without execution controls', () => {
    render(<AutomationWorkflowDraftForm canManage projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('heading', { name: 'Create workflow draft' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft workflow' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate workflow/i })).not.toBeInTheDocument();
  });

  it('renders a permission boundary for non-managers', () => {
    render(<AutomationWorkflowDraftForm canManage={false} projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByText(/Only workspace managers and admins can create workflow drafts/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create draft workflow' })).not.toBeInTheDocument();
  });
});
