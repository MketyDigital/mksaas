import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders, userEvent } from '@/__tests__/test-utils';
import { signIn } from '@/shared/lib/auth-client';

import { LoginForm } from '../LoginForm';

jest.mock('@/shared/lib/auth-client', () => ({
  signIn: jest.fn(),
}));

const renderConfiguredLoginForm = () => renderWithProviders(<LoginForm enableAuth0Login enableDevelopmentLogin />);

const mockLocation = {
  href: '',
  origin: 'http://localhost',
  assign: jest.fn(),
  replace: jest.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
  });

  it('renders the fail-closed no-provider state', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText(/Mkety identity is not configured/i)).toBeInTheDocument();
  });

  it('routes a configured identity attempt through the Mkety identity client without redirecting automatically', async () => {
    const user = userEvent.setup();
    (signIn as jest.Mock).mockResolvedValue({ error: 'Mkety identity is not configured yet.', url: null });

    renderConfiguredLoginForm();
    await user.click(screen.getByRole('button', { name: /continue with configured identity/i }));

    expect(signIn).toHaveBeenCalledWith('auth0', {
      callbackUrl: '/select-tenant',
      redirect: false,
    });
    await waitFor(() => {
      expect(screen.getByText(/Mkety identity is not configured yet/i)).toBeInTheDocument();
    });
  });

  it('refuses development login while the Mkety identity adapter is unavailable', async () => {
    const user = userEvent.setup();
    (signIn as jest.Mock).mockResolvedValue({ error: 'Mkety identity is not configured yet.', url: null });

    renderConfiguredLoginForm();
    await user.type(screen.getByLabelText(/email/i), 'dev@example.com');
    await user.click(screen.getByRole('button', { name: /development login/i }));

    expect(signIn).toHaveBeenCalledWith('development', {
      email: 'dev@example.com',
      redirect: false,
      callbackUrl: '/select-tenant',
    });
    await waitFor(() => {
      expect(screen.getByText(/Mkety identity is not configured yet/i)).toBeInTheDocument();
    });
  });

  it('does not expose legacy provider controls when none are configured', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.queryByRole('button', { name: /configured identity/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /development login/i })).not.toBeInTheDocument();
  });
});
