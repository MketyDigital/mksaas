import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MketyAcademyHubSection, MketyProductShowcase, type MketyShowcaseGroup } from '../MketyPublicExperience';

const showcaseGroups: MketyShowcaseGroup[] = [
  {
    id: 'platform',
    label: 'Platform',
    eyebrow: 'Platform Core',
    title: 'Build and operate from one system',
    description: 'A unified operating surface.',
    href: '/platform',
    items: [
      { key: 'ai', title: 'AI', description: 'Build assistants and agents.', href: '/platform#ai' },
      { key: 'deploy', title: 'Deploy', description: 'Ship applications.', href: '/platform#deploy' },
    ],
  },
  {
    id: 'academy',
    label: 'Academy',
    eyebrow: 'Learn',
    title: 'Practical learning',
    description: 'Build modern skills.',
    href: '/academy',
    items: [
      { key: 'automation', title: 'Automation Lab', description: 'Learn automation.', href: '/academy#automation' },
    ],
  },
];

describe('Mkety public app experience', () => {
  it('exposes an accessible tabbed product showcase and switches the visible panel', async () => {
    const user = userEvent.setup();
    render(<MketyProductShowcase groups={showcaseGroups} />);

    expect(screen.getByRole('tablist', { name: /explore mkety/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Platform' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Build and operate from one system')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Academy' }));

    expect(screen.getByRole('tab', { name: 'Academy' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Practical learning')).toBeInTheDocument();
  });

  it('keeps the complete legacy At Our Hubs module set', () => {
    render(<MketyAcademyHubSection />);

    expect(screen.getByRole('heading', { name: /at our hubs/i })).toBeInTheDocument();
    expect(screen.getByText('Web & App Engineering')).toBeInTheDocument();
    expect(screen.getByText('Trading Masterclass')).toBeInTheDocument();
    expect(screen.getByText('Digital Funnel & Marketing')).toBeInTheDocument();
    expect(screen.getByText('AI & Automation Lab')).toBeInTheDocument();
    expect(screen.getByText('Certified Digital Skills')).toBeInTheDocument();
  });
});
