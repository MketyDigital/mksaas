import { render, screen } from '@testing-library/react';

import { AiWorkspaceOverview, buildAiWorkspaceCapabilities } from './AiWorkspaceOverview';

describe('AiWorkspaceOverview', () => {
  it('renders the AI workspace capability map', () => {
    render(<AiWorkspaceOverview agentCount={2} canManage projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('heading', { name: /Build, connect, test, and publish agents/i })).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Runs')).toBeInTheDocument();
    expect(screen.getByText('Versions')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('2 total agents')).toBeInTheDocument();
  });

  it('links only currently available AI surfaces', () => {
    render(<AiWorkspaceOverview agentCount={1} canManage projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('link', { name: /Agents/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Knowledge/i })).toHaveAttribute('href', '/t/acme/projects/demo/knowledge');
    expect(screen.queryByRole('link', { name: /Tools/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Publish/i })).not.toBeInTheDocument();
  });

  it('keeps publish protected while still visible in the AI roadmap', () => {
    const publish = buildAiWorkspaceCapabilities({ agentCount: 0, canManage: false, projectSlug: 'demo', tenantSlug: 'acme' }).find(
      (capability) => capability.key === 'publish',
    );

    expect(publish?.statusLabel).toBe('Protected');
    expect(publish?.href).toBeUndefined();
  });
});
