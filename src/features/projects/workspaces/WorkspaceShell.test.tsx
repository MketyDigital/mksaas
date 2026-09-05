import { render, screen } from '@testing-library/react';

import { getProjectWorkspaceByKey } from './registry';
import { WorkspaceShell } from './WorkspaceShell';

describe('WorkspaceShell', () => {
  it('renders workspace title, project context, and children', () => {
    render(
      <WorkspaceShell projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspace={getProjectWorkspaceByKey('automation')}>
        <p>Workflow builder coming soon.</p>
      </WorkspaceShell>,
    );

    expect(screen.getByRole('heading', { name: 'Automation Workspace' })).toBeInTheDocument();
    expect(screen.getByText(/Demo Project/i)).toBeInTheDocument();
    expect(screen.getByText('Workflow builder coming soon.')).toBeInTheDocument();
  });

  it('renders enterprise protection copy for Trading', () => {
    render(
      <WorkspaceShell projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspace={getProjectWorkspaceByKey('trading')}>
        <p>Trading system request only.</p>
      </WorkspaceShell>,
    );

    expect(screen.getByText(/custom enterprise solution/i)).toBeInTheDocument();
    expect(screen.getByText(/does not create trading accounts/i)).toBeInTheDocument();
  });
});
