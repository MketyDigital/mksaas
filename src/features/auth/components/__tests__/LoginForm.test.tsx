import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders, userEvent } from '@/__tests__/test-utils';

const mockLogin = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => mockUseAuth() }));

import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ login: mockLogin, logout: jest.fn(), user: null, isLoading: false, isAuthenticated: false, refresh: jest.fn() });
  });

  it('renders the Mkety/ZITADEL sign-in action', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with zitadel/i })).toBeInTheDocument();
  });

  it('initiates Mkety login with the tenant-selection callback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /continue with zitadel/i }));

    expect(mockLogin).toHaveBeenCalledWith('/select-tenant');
  });

  it('shows a provider-neutral authentication message', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByText(/authentication is managed by mkety/i)).toBeInTheDocument();
    expect(screen.queryByText(/auth0/i)).not.toBeInTheDocument();
  });

  it('shows an error if login initiation fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('failed'));
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /continue with zitadel/i }));

    await waitFor(() => expect(screen.getByText(/failed to initiate sign in/i)).toBeInTheDocument());
  });
});
