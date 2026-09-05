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

  it('renders workspace readiness counts', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByText('Available now')).toBeInTheDocument();
    expect(screen.getByText('Planned next')).toBeInTheDocument();
    expect(screen.getByText('Enterprise only')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('Available now').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Planned next').previousElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Enterprise only').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Protected').previousElementSibling).toHaveTextContent('0');
  });

  it('links workspace cards to their project routes', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByRole('link', { name: /Open AI Workspace/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Request Trading System/i })).toHaveAttribute('href', '/t/acme/projects/demo/trading');
  });
});
