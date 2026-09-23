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

  it('renders the minimal Mkety sign-in action', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByRole('button', { name: /continue to mkety/i })).toBeInTheDocument();
    expect(screen.queryByText('Sign in to Mkety')).not.toBeInTheDocument();
  });

  it('initiates Mkety login with the tenant-selection callback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /continue to mkety/i }));

    expect(mockLogin).toHaveBeenCalledWith('/select-tenant', 'signin');
  });

  it('keeps the authentication action provider-neutral', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.queryByText(/auth0|zitadel|nextauth|auth\.js/i)).not.toBeInTheDocument();
  });

  it('initiates Mkety signup with the supplied callback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm mode="signup" callbackUrl="/select-tenant?plan=starter" />);

    await user.click(screen.getByRole('button', { name: /create mkety account/i }));

    expect(mockLogin).toHaveBeenCalledWith('/select-tenant?plan=starter', 'signup');
  });

  it('shows an error if login initiation fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('failed'));
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /continue to mkety/i }));

    await waitFor(() => expect(screen.getByText(/failed to initiate sign in/i)).toBeInTheDocument());
  });
});
