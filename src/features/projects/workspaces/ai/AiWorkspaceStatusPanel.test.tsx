import { render, screen } from '@testing-library/react';

import { AiWorkspaceStatusPanel } from './AiWorkspaceStatusPanel';

describe('AiWorkspaceStatusPanel', () => {
  it('shows AI workspace readiness and counts', () => {
    render(<AiWorkspaceStatusPanel agentCount={2} canManage={true} knowledgeStatus="Ready for project knowledge" />);

    expect(screen.getByRole('heading', { name: /AI Workspace status/i })).toBeInTheDocument();
    expect(screen.getByText('2 agents')).toBeInTheDocument();
    expect(screen.getByText('Ready for project knowledge')).toBeInTheDocument();
    expect(screen.getByText(/Management available/i)).toBeInTheDocument();
  });
});
