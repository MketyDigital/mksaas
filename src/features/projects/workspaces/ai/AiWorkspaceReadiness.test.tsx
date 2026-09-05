import { render, screen } from '@testing-library/react';

import { AiWorkspaceReadiness, buildAiWorkspaceReadiness } from './AiWorkspaceReadiness';

describe('AiWorkspaceReadiness', () => {
  it('keeps tools, runs, versions, and publish staged', () => {
    const items = buildAiWorkspaceReadiness({ agentCount: 1, canManage: true, projectSlug: 'demo', tenantSlug: 'acme' });

    expect(items.find((item) => item.key === 'agents')?.status).toBe('available');
    expect(items.find((item) => item.key === 'knowledge')?.status).toBe('available');
    expect(items.find((item) => item.key === 'tools')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'runs')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'versions')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'publish')?.status).toBe('protected');
  });

  it('renders available links without live execution ctas', () => {
    render(<AiWorkspaceReadiness agentCount={1} canManage={true} projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('link', { name: /Agents/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Knowledge/i })).toHaveAttribute('href', '/t/acme/projects/demo/knowledge');
    expect(screen.queryByRole('link', { name: /Publish now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run agent/i })).not.toBeInTheDocument();
  });
});
