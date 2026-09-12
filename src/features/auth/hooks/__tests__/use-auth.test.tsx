import { act, renderHook } from '@testing-library/react';

import { AuthContext } from '@/shared/components/providers/auth-provider';

import { useAuth } from '../use-auth';

const mockAssign = jest.fn();
Object.defineProperty(window, 'location', {
  configurable: true,
  value: { ...window.location, assign: mockAssign },
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        session: null,
        isLoading: false,
        refresh: jest.fn().mockResolvedValue(undefined),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

describe('useAuth', () => {
  beforeEach(() => mockAssign.mockClear());

  it('returns loading state from Mkety Auth context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthContext.Provider value={{ session: null, isLoading: true, refresh: jest.fn() }}>
          {children}
        </AuthContext.Provider>
      ),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('returns the Mkety session user', () => {
    const user = {
      id: 'user-123',
      name: 'Test User',
      email: 'user@example.com',
      image: null,
      roles: { 'test-tenant': 'admin' as const },
      permissions: { 'test-tenant': ['*'] },
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthContext.Provider value={{ session: { user, expiresAt: new Date('2026-10-01') }, isLoading: false, refresh: jest.fn() }}>
          {children}
        </AuthContext.Provider>
      ),
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('navigates to the Mkety login route', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => result.current.login('/dashboard'));

    expect(mockAssign).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fdashboard');
  });

  it('navigates to the Mkety logout route', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => result.current.logout('/login'));

    expect(mockAssign).toHaveBeenCalledWith('/api/auth/logout?returnTo=%2Flogin');
  });
});
