import { render, screen } from '@testing-library/react';

import { AutomationWorkflowMetadataForm } from './AutomationWorkflowMetadataForm';

const workflow = {
  description: 'Follow up with new leads.',
  name: 'Lead follow-up',
  slug: 'lead-follow-up',
};

describe('AutomationWorkflowMetadataForm', () => {
  it('renders a manager-only metadata edit form', () => {
    render(
      <AutomationWorkflowMetadataForm
        canManage
        projectSlug="demo"
        tenantSlug="acme"
        workflow={workflow}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit workflow details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow name')).toHaveValue('Lead follow-up');
    expect(screen.getByLabelText('Description')).toHaveValue('Follow up with new leads.');
    expect(screen.getByRole('button', { name: 'Save workflow details' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Trigger/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nodes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run workflow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
  });

  it('renders boundary copy for non-managers', () => {
    render(
      <AutomationWorkflowMetadataForm
        canManage={false}
        projectSlug="demo"
        tenantSlug="acme"
        workflow={workflow}
      />,
    );

    expect(screen.getByText('Only managers can edit workflow details.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save workflow details' })).not.toBeInTheDocument();
  });
});
