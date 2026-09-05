import { render, screen } from '@testing-library/react';

import { AiAgentSummaryGrid } from './AiAgentSummaryGrid';

describe('AiAgentSummaryGrid', () => {
  it('links agents to Agent Builder', () => {
    render(
      <AiAgentSummaryGrid
        agents={[
          {
            id: '1',
            name: 'Support Bot',
            slug: 'support-bot',
            status: 'draft',
            provider: 'openai',
            model: 'gpt-4o',
            instructions: 'Answer support questions.',
          },
        ]}
        canManage={true}
        projectSlug="demo"
        tenantSlug="acme"
      />,
    );

    expect(screen.getByRole('link', { name: /Support Bot/i })).toHaveAttribute('href', '/t/acme/projects/demo/agents/support-bot');
    expect(screen.getByText(/Open Agent Builder/i)).toBeInTheDocument();
  });

  it('renders a helpful no-agent state', () => {
    render(<AiAgentSummaryGrid agents={[]} canManage={true} projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByText(/No agents yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your first AI agent/i)).toBeInTheDocument();
  });
});
