import { render, screen } from '@testing-library/react';

import { AiWorkspaceOverview, buildAiWorkspaceCapabilities } from './AiWorkspaceOverview';

function expectCapabilityHeadingLink(name: string, href: string) {
  const heading = screen.getByRole('heading', { name });
  expect(heading.closest('a')).toHaveAttribute('href', href);
}

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

    expectCapabilityHeadingLink('Agents', '/t/acme/projects/demo/ai');
    expectCapabilityHeadingLink('Knowledge', '/t/acme/projects/demo/knowledge');
    expect(screen.getByRole('heading', { name: 'Tools' }).closest('a')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Publish' }).closest('a')).toBeNull();
  });

  it('keeps publish protected while still visible in the AI roadmap', () => {
    const publish = buildAiWorkspaceCapabilities({ agentCount: 0, canManage: false, projectSlug: 'demo', tenantSlug: 'acme' }).find(
      (capability) => capability.key === 'publish',
    );

    expect(publish?.statusLabel).toBe('Protected');
    expect(publish?.href).toBeUndefined();
  });
});
