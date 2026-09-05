import { render, screen } from '@testing-library/react';

import { AutomationWorkflowNodeConfigDraftForm } from './AutomationWorkflowNodeConfigDraftForm';

const nodes = [
  {
    canConfigure: true,
    configDraft: { label: 'Follow up', notes: 'Internal only' },
    configKeys: ['label', 'notes', 'agentId'],
    id: 'agent-1',
    isSupported: true,
    readinessLabel: 'Prepared' as const,
    type: 'agent',
  },
  {
    canConfigure: false,
    configDraft: { label: '', notes: '' },
    configKeys: ['custom'],
    id: 'legacy-2',
    isSupported: false,
    readinessLabel: 'Needs review' as const,
    type: 'custom-provider',
  },
];

describe('AutomationWorkflowNodeConfigDraftForm', () => {
  it('renders safe draft metadata fields for configurable nodes only', () => {
    render(
      <AutomationWorkflowNodeConfigDraftForm
        canManage
        nodes={nodes}
        projectSlug="demo"
        tenantSlug="acme"
        workflowSlug="lead-follow-up"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Configure node metadata' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Follow up')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Internal only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save agent-1 draft config' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save legacy-2 draft config' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/URL/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
  });

  it('renders a permission boundary for non-managers', () => {
    render(
      <AutomationWorkflowNodeConfigDraftForm
        canManage={false}
        nodes={nodes}
        projectSlug="demo"
        tenantSlug="acme"
        workflowSlug="lead-follow-up"
      />,
    );

    expect(screen.getByText(/Only managers can edit node draft metadata/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft config/i })).not.toBeInTheDocument();
  });
});
