import { render, screen } from '@testing-library/react';

import { projectWorkspaces } from './registry';
import { WorkspaceHub } from './WorkspaceHub';

describe('WorkspaceHub', () => {
  it('renders every Mkety project workspace card', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByRole('heading', { name: /Demo Project/i })).toBeInTheDocument();
    expect(screen.getByText('AI Workspace')).toBeInTheDocument();
    expect(screen.getByText('Automation Workspace')).toBeInTheDocument();
    expect(screen.getByText('Deploy Workspace')).toBeInTheDocument();
    expect(screen.getByText('SolutionHub')).toBeInTheDocument();
    expect(screen.getByText('Trading Workspace')).toBeInTheDocument();
  });

  it('links workspace cards to their project routes', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByRole('link', { name: /Open AI Workspace/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Request Trading System/i })).toHaveAttribute('href', '/t/acme/projects/demo/trading');
  });
});
