import { render, screen } from '@testing-library/react';

import { AgentBuilderStatusPanel } from './AgentBuilderStatusPanel';

describe('AgentBuilderStatusPanel', () => {
  it('summarizes the editable agent configuration and safe publishing state', () => {
    render(
      <AgentBuilderStatusPanel
        agent={{
          name: 'Support Concierge',
          status: 'draft',
          provider: 'openai',
          model: 'gpt-4o-mini',
          hasInstructions: true,
          hasConfig: true,
        }}
        publishedVersionNumber={2}
        versionCount={3}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Support Concierge' })).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    expect(screen.getByText('Instructions ready')).toBeInTheDocument();
    expect(screen.getByText('Advanced config present')).toBeInTheDocument();
    expect(screen.getByText('3 versions')).toBeInTheDocument();
    expect(screen.getByText('Production pinned to v2')).toBeInTheDocument();
  });

  it('shows safe empty states without creating runtime behavior', () => {
    render(
      <AgentBuilderStatusPanel
        agent={{
          name: 'New Agent',
          status: 'disabled',
          provider: 'platform',
          model: null,
          hasInstructions: false,
          hasConfig: false,
        }}
        publishedVersionNumber={null}
        versionCount={0}
      />,
    );

    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Model not selected')).toBeInTheDocument();
    expect(screen.getByText('Instructions missing')).toBeInTheDocument();
    expect(screen.getByText('No advanced config')).toBeInTheDocument();
    expect(screen.getByText('0 versions')).toBeInTheDocument();
    expect(screen.getByText('No published version')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run agent/i })).not.toBeInTheDocument();
  });
});
