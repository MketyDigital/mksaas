import { act, renderHook } from '@testing-library/react';

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockUseSession = jest.fn();

jest.mock('@/shared/lib/auth-client', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: () => mockUseSession(),
}));

import { useAuth } from '../use-auth';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports loading without inventing a user', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('passes through a verified session when the identity adapter provides one', () => {
    const mockUser = {
      id: 'user-123',
      name: 'Test User',
      email: 'user@example.com',
      image: 'https://example.com/avatar.jpg',
      roles: {},
      permissions: {},
    };
    mockUseSession.mockReturnValue({ data: { user: mockUser }, status: 'authenticated' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('fails closed when no identity is available', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('routes login through the Mkety identity client', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockSignIn.mockResolvedValue({ error: 'Mkety identity is not configured yet.', url: null });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login(undefined, '/dashboard');
    });

    expect(mockSignIn).toHaveBeenCalledWith(undefined, { callbackUrl: '/dashboard' });
  });

  it('routes logout through the Mkety identity client', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout('/goodbye');
    });

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/goodbye' });
  });
});
