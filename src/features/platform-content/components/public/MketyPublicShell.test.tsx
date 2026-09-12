import { render, screen } from '@testing-library/react';

import { MketyPublicShell } from './MketyPublicShell';
import { defaultFooterGroups, defaultPlatformNavigation, defaultPlatformSiteSettings } from '../../defaults';

describe('MketyPublicShell', () => {
  it('renders consistent public navigation, CTAs and legal destinations', () => {
    render(
      <MketyPublicShell
        settings={defaultPlatformSiteSettings}
        navigation={defaultPlatformNavigation}
        footerGroups={defaultFooterGroups}
      >
        <h1>Public content</h1>
      </MketyPublicShell>,
    );

    expect(screen.getByRole('link', { name: 'Mkety' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/create-workspace');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('heading', { name: 'Public content' })).toBeInTheDocument();
  });

  it('provides an accessible mobile navigation disclosure', () => {
    render(
      <MketyPublicShell
        settings={defaultPlatformSiteSettings}
        navigation={defaultPlatformNavigation}
        footerGroups={defaultFooterGroups}
      >
        <div>Body</div>
      </MketyPublicShell>,
    );

    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
  });
});
